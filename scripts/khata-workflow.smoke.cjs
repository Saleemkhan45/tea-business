const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { chromium } = require('playwright')

const baseURL = process.env.KHATA_UI_URL || 'http://127.0.0.1:5173'
const screenshotDir = path.join(os.tmpdir(), 'phase31-khata-smoke')
const customerId = '507f1f77bcf86cd799439011'
const stockId = '507f1f77bcf86cd799439012'
const saleId = '507f1f77bcf86cd799439013'
const cashSaleId = '507f1f77bcf86cd799439016'
const operatorId = '507f1f77bcf86cd799439015'
const shopId = '507f1f77bcf86cd799439014'
const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
const today = ['year', 'month', 'day'].map(part => dateParts.find(value => value.type === part).value).join('-')
const timestamp = `${today}T09:00:00.000Z`
const customer = { id: customerId, name: 'Ahmed Traders', phone: '0300 1112223', address: 'Main bazaar', status: 'active', currentBalancePkr: 20000 }
const sale = { _id: saleId, shop: shopId, customer: customerId, customerName: customer.name, customerRegion: 'Lahore', businessDate: today, teaType: 'green', stockLocationId: stockId, productName: 'Green Tea Premium', quantityKg: 10, unitPrice: 1000, totalAmount: 10000, amountPaid: 4000, paymentMethod: 'credit', receivedPaymentMethod: 'cash', enteredByName: 'Admin', createdBy: operatorId, status: 'completed', ledgerRecorded: true, notes: null, inventoryMovements: [], editHistory: [], createdAt: timestamp, updatedAt: timestamp }
const cashSale = { ...sale, _id: cashSaleId, customer: undefined, customerName: 'Counter customer', totalAmount: 1000, quantityKg: 1, amountPaid: 1000, paymentMethod: 'cash' }
const ledgerBase = { businessId: shopId, customerId, businessDate: today, status: 'active', createdBy: operatorId, enteredByName: 'Admin', createdAt: timestamp, updatedAt: timestamp, notes: null }
const opening = { ...ledgerBase, id: 'opening', type: 'opening_balance', amountPkr: 20000 }
const purchase = { ...ledgerBase, id: 'purchase', type: 'purchase', saleId, stockLocationId: stockId, teaType: 'green', productName: sale.productName, quantityKg: 10, ratePerKgPkr: 1000, amountPkr: 10000, salePaymentMethod: 'credit' }
const received = { ...ledgerBase, id: 'receipt', type: 'payment', saleId, amountPkr: 4000, paymentMethod: 'cash' }
const row = (transaction, impact, balance) => ({ transactionId: transaction.id, businessDate: today, type: transaction.type, teaType: transaction.teaType ?? null, quantityKg: transaction.quantityKg ?? null, ratePerKgPkr: transaction.ratePerKgPkr ?? null, amountPkr: transaction.amountPkr, balanceImpactPkr: impact, runningBalancePkr: balance, paymentMethod: transaction.paymentMethod ?? null, status: 'active', createdBy: operatorId, createdAt: timestamp })

async function run() {
  await fs.mkdir(screenshotDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  let page
  const errors = []
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
    page.on('pageerror', error => errors.push(error.message))
    const requests = []
    let saved = false
    let paid = false
    let cashCancelled = false
    let releaseSale, releasePayment
    const saleGate = new Promise(resolve => { releaseSale = resolve })
    const paymentGate = new Promise(resolve => { releasePayment = resolve })
    const currentBalance = () => paid ? 20000 : saved ? 26000 : 20000
    const summary = () => ({ customerId, currentBalancePkr: currentBalance(), totalPurchasedPkr: saved ? 10000 : 0, totalPurchasedKg: saved ? 10 : 0, totalPaidPkr: paid ? 10000 : saved ? 4000 : 0, todayPurchasedPkr: saved ? 10000 : 0, todayPaidPkr: paid ? 10000 : saved ? 4000 : 0, lastPaymentDate: saved ? today : null, daysSinceLastPayment: saved ? 0 : null })
    const ledger = () => {
      const transactions = [opening, purchase, received]
      const rows = [row(opening, 20000, 20000), row(purchase, 10000, 30000), row(received, -4000, 26000)]
      if (paid) { const payment = { ...ledgerBase, id: 'standalone-payment', type: 'payment', amountPkr: 6000, paymentMethod: 'cash', reference: 'RCPT-31' }; transactions.push(payment); rows.push(row(payment, -6000, 20000)) }
      return { customerId, transactions, rows, currentBalancePkr: currentBalance() }
    }
    await page.route('**/api/v1/**', async route => {
      const request = route.request()
      const url = new URL(request.url())
      const body = request.postDataJSON()
      requests.push({ path: url.pathname, method: request.method(), search: url.searchParams.get('search'), limit: url.searchParams.get('limit'), body })
      const send = (payload, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) })
      if (url.pathname.endsWith('/auth/demo-token')) return send({ token: 'browser-test-token' })
      if (url.pathname.endsWith('/notifications/unread-count')) return send({ count: 0 })
      if (url.pathname.endsWith('/notifications')) return send({ notifications: [], pagination: { page: 1, pages: 1, total: 0 } })
      if (url.pathname.endsWith('/sales/entry-options')) return send({ operator: { id: operatorId, name: 'Admin', role: 'owner' }, items: [{ id: stockId, name: sale.productName, teaType: 'green', availableKg: saved ? 70 : 80, sellingPrice: 1000 }] })
      if (url.pathname.endsWith('/sales/summary')) return send({ summary: { date: today, salesPkr: 11000, greenKg: 11, blackKg: 0, transactions: 2, cashReceivedPkr: 5000, khataPkr: 10000, outstandingPkr: currentBalance() } })
      if (url.pathname === '/api/v1/sales' && request.method() === 'POST') { await saleGate; saved = true; return send({ sale }, 201) }
      if (url.pathname === '/api/v1/sales') return send({ sales: [sale, { ...cashSale, status: cashCancelled ? 'voided' : 'completed' }] })
      if (url.pathname.endsWith(`/sales/${saleId}/void`)) return send({ message: 'Sale cancellation would create a negative customer balance. Resolve later payments or ledger activity before cancelling this sale.' }, 409)
      if (url.pathname.endsWith(`/sales/${cashSaleId}/void`)) { cashCancelled = true; return send({ sale: { ...cashSale, status: 'voided' } }) }
      if (url.pathname === '/api/v1/customers') {
        const search = url.searchParams.get('search') || ''
        if (search === 'error') return send({ message: 'Customer search unavailable.' }, 404)
        if (search === 'slow') await new Promise(resolve => setTimeout(resolve, 650))
        return send({ customers: search === 'missing' ? [] : [{ ...customer, currentBalancePkr: currentBalance() }], pagination: { page: 1, limit: 10, total: search === 'missing' ? 0 : 1, pages: 1 } })
      }
      if (url.pathname === `/api/v1/customers/${customerId}`) return send({ customer })
      if (url.pathname.endsWith('/summary')) return send({ summary: summary() })
      if (url.pathname.endsWith('/ledger')) return send(ledger())
      if (url.pathname.endsWith('/payments') && request.method() === 'POST') { await paymentGate; paid = true; return send({ transaction: ledger().transactions.at(-1) }, 201) }
      if (url.pathname.endsWith('/daily-payments')) return send({ customerId, buckets: [{ date: today, amountPkr: paid ? 10000 : 4000, transactionCount: paid ? 2 : 1 }] })
      if (url.pathname.endsWith('/payment-calendar')) return send({ customerId, buckets: [{ date: today, amountPkr: paid ? 10000 : 4000, transactionCount: paid ? 2 : 1, level: 'high' }] })
      if (url.pathname.endsWith('/payment-insights')) return send({ customerId, insight: { highestPaymentDay: { date: today, amountPkr: 4000, transactionCount: 1 }, zeroPaymentDays: 0, averageDailyPaymentPkr: 4000, averagePaymentAmountPkr: 4000, paymentDaysCount: 1, paymentTransactionCount: 1, lastPaymentDate: today, daysSinceLastPayment: 0, averagePaymentIntervalDays: null, estimatedDaysToClear: 7 } })
      if (url.pathname.endsWith('/reminder-candidate')) return send({ candidate: null })
      return send({ message: 'Unexpected test endpoint.' }, 404)
    })

    await page.goto(`${baseURL}/sales`)
    await page.getByRole('button', { name: 'Add Daily Sale', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Add Daily Sale' })
    const search = dialog.getByRole('textbox', { name: 'Search customer by name or phone' })
    await search.fill('missing')
    await dialog.getByText('No customers found', { exact: true }).waitFor()
    await search.fill('error')
    await dialog.getByText('Customers unavailable.', { exact: false }).waitFor()
    await search.fill('slow')
    await dialog.getByText('Searching customers...', { exact: true }).waitFor()
    await dialog.getByRole('button', { name: /Ahmed Traders.*0300/ }).waitFor()
    const beforeSearch = requests.length
    await search.fill('0')
    await search.fill('03')
    await search.fill('0300')
    await page.waitForTimeout(350)
    assert.deepEqual(requests.slice(beforeSearch).filter(value => value.path === '/api/v1/customers').map(value => value.search), ['0300'])
    assert.equal(requests.at(-1).limit, '10')
    await dialog.getByRole('button', { name: /Ahmed Traders.*0300/ }).click()
    await dialog.getByText('PKR 20,000', { exact: true }).waitFor()
    assert.equal(await dialog.getByLabel('Entered By', { exact: true }).getAttribute('readonly'), '')
    assert.equal(await dialog.getByLabel('Entered By', { exact: true }).inputValue(), 'Admin')
    assert.doesNotMatch(await dialog.innerText(), /Customer ID|Stock Item ID|507f1f77/)
    await dialog.getByRole('button', { name: /Sale inventory item:/ }).click()
    await dialog.getByRole('option', { name: /Green Tea Premium/ }).click()
    await dialog.getByLabel('Quantity (kg)', { exact: true }).fill('10')
    assert.equal(await dialog.getByLabel('Unit Price (PKR)', { exact: true }).inputValue(), '1000')
    assert.match(await dialog.locator('.sale-cash-preview').innerText(), /Today's Purchase\s+PKR 10,000\s+Amount Received\s+PKR 10,000\s+Due\s+PKR 0/)
    await dialog.getByLabel('Quantity (kg)', { exact: true }).fill('81')
    await dialog.getByRole('button', { name: 'Save Sale', exact: true }).click()
    await dialog.getByText('Only 80 kg is currently available.', { exact: true }).waitFor()
    await dialog.getByLabel('Quantity (kg)', { exact: true }).fill('10')
    await dialog.getByRole('button', { name: /Sale payment method:/ }).click()
    await dialog.getByRole('option', { name: 'Khata / Credit', exact: true }).click()
    assert.match(await dialog.locator('.sale-new-balance').innerText(), /New Khata\s+PKR 30,000/)
    await dialog.getByLabel('Amount Received Today (PKR)', { exact: true }).fill('11000')
    assert.equal((await dialog.locator('.sale-new-balance dd').innerText()).trim(), '-')
    await dialog.getByRole('button', { name: 'Save Sale', exact: true }).click()
    await dialog.getByText('Received amount must be a whole PKR value between zero and the sale total.', { exact: true }).waitFor()
    await dialog.getByLabel('Amount Received Today (PKR)', { exact: true }).fill('4000')
    assert.match(await dialog.locator('.sale-new-balance').innerText(), /New Khata\s+PKR 26,000/)
    await page.screenshot({ path: path.join(screenshotDir, 'desktop-sale.png'), fullPage: true })
    await dialog.getByRole('button', { name: 'Save Sale', exact: true }).click()
    await dialog.getByRole('button', { name: 'Saving...', exact: true }).waitFor()
    assert.equal(await dialog.getByRole('button', { name: 'Saving...', exact: true }).isDisabled(), true)
    await dialog.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    releaseSale()
    await page.getByText('Sale recorded.', { exact: true }).waitFor()
    const saleWrites = requests.filter(value => value.path === '/api/v1/sales' && value.method === 'POST')
    assert.equal(saleWrites.length, 1)
    assert.equal(saleWrites[0].body.customerId, customerId)
    assert.equal(saleWrites[0].body.stockLocationId, stockId)
    assert.equal(saleWrites[0].body.amountPaid, 4000)
    for (const field of ['createdBy', 'enteredBy', 'shop', 'totalAmount', 'balance']) assert.equal(field in saleWrites[0].body, false)
    assert.ok(requests.filter(value => value.path.endsWith('/sales/entry-options')).length >= 2)
    console.log('PASS sale selection, search states/debounce, previews, stock validation, save guard and refresh')

    await page.goto(`${baseURL}/customers/${customerId}`)
    await page.getByRole('heading', { name: 'Ahmed Traders', exact: true }).waitFor()
    await page.getByRole('heading', { name: 'Khata Ledger', exact: true }).waitFor()
    assert.doesNotMatch(await page.locator('.customer-detail-header').innerText(), /507f1f77/)
    assert.match(await page.locator('.customer-metrics').innerText(), /Current Khata\s+PKR 26,000/)
    assert.match(await page.locator('.customer-ledger-table').innerText(), /Green Tea Premium/)
    await page.screenshot({ path: path.join(screenshotDir, 'desktop-khata.png'), fullPage: true })
    await page.getByRole('button', { name: 'Receive Payment', exact: true }).click()
    const payment = page.getByRole('dialog', { name: 'Receive Payment', exact: true })
    assert.match(await payment.locator('.customer-payment-context').innerText(), /Current Khata\s+PKR 26,000/)
    await payment.getByLabel('Amount Received (PKR)', { exact: true }).fill('26001')
    await payment.getByRole('button', { name: 'Record Payment', exact: true }).click()
    await payment.getByText('Payment cannot exceed the outstanding balance.', { exact: true }).waitFor()
    await payment.getByLabel('Amount Received (PKR)', { exact: true }).fill('6000')
    await payment.getByLabel('Reference / Receipt #', { exact: true }).fill('RCPT-31')
    const beforePayment = requests.length
    await payment.getByRole('button', { name: 'Record Payment', exact: true }).click()
    await payment.getByRole('button', { name: 'Saving...', exact: true }).waitFor()
    assert.equal(await payment.getByRole('button', { name: 'Saving...', exact: true }).isDisabled(), true)
    await payment.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    releasePayment()
    await page.getByText('Payment recorded.', { exact: true }).waitFor()
    const paymentRequests = requests.slice(beforePayment)
    assert.equal(paymentRequests.filter(value => value.method === 'POST' && value.path.endsWith('/payments')).length, 1)
    assert.equal(paymentRequests.filter(value => value.method === 'POST' && value.path === '/api/v1/sales').length, 0)
    assert.ok(paymentRequests.some(value => value.path.endsWith('/ledger') && value.method === 'GET'))
    assert.ok(paymentRequests.some(value => value.path.endsWith('/summary') && value.method === 'GET'))
    assert.match(await page.locator('.customer-metrics').innerText(), /Current Khata\s+PKR 20,000/)
    assert.match(await page.locator('.customer-metrics').innerText(), /Paid Today\s+PKR 10,000/)
    await page.locator('.customer-ledger-table').getByText('RCPT-31', { exact: false }).waitFor()
    console.log('PASS standalone payment endpoint, validation, submit guard and authoritative summary/ledger refresh')

    await page.goto(`${baseURL}/sales`)
    page.on('dialog', dialog => dialog.accept('Operator correction'))
    await page.getByRole('button', { name: 'Actions for Ahmed Traders', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Cancel Sale', exact: true }).click()
    await page.getByText("Cannot cancel this sale because later customer payments affect the current Khata balance. Review the customer's ledger first.", { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Actions for Counter customer', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Cancel Sale', exact: true }).click()
    await page.getByText('Cancelled', { exact: true }).waitFor()
    console.log('PASS cancellation conflict message and cancelled status from the API')

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${baseURL}/customers/${customerId}`)
    await page.getByRole('heading', { name: 'Khata Ledger', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true)
    await page.screenshot({ path: path.join(screenshotDir, 'mobile-khata.png'), fullPage: true })
    await page.getByRole('button', { name: 'Receive Payment', exact: true }).click()
    await page.screenshot({ path: path.join(screenshotDir, 'mobile-payment.png'), fullPage: true })
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
    await page.getByRole('button', { name: 'Add Sale', exact: true }).click()
    await page.getByRole('button', { name: /Sale inventory item:/ }).click()
    await page.getByRole('option', { name: /Green Tea Premium/ }).click()
    await page.getByLabel('Quantity (kg)', { exact: true }).fill('1')
    await page.getByRole('button', { name: /Sale payment method:/ }).click()
    await page.getByRole('option', { name: 'Khata / Credit', exact: true }).click()
    await page.getByRole('button', { name: 'Save Sale', exact: true }).scrollIntoViewIfNeeded()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true)
    await page.screenshot({ path: path.join(screenshotDir, 'mobile-sale.png'), fullPage: true })
    assert.deepEqual(errors, [])
    console.log(`PASS mobile layout and no browser exceptions; screenshots: ${screenshotDir}`)
  } catch (error) {
    if (page) {
      await page.screenshot({ path: path.join(screenshotDir, 'failure.png'), fullPage: true })
      console.error('Browser exceptions:', errors)
      console.error('Dialog text:', await page.getByRole('dialog').innerText().catch(() => 'No dialog'))
    }
    throw error
  } finally { await browser.close() }
}

run().catch(error => { console.error(error); process.exitCode = 1 })
