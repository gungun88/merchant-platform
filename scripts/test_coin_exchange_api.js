const crypto = require('crypto')

const API_URL = 'http://localhost:3000/api/exchange/coins-to-points'
const API_SECRET = 'E483D0FCDCA7D2A900F679BFBE149BB34FE518A149BB8B7529EB0FCA6773BF45'
const TEST_USER_EMAIL = 'pengqibao3@gmail.com'

function generateSignature(data, secret) {
  const sortedKeys = Object.keys(data).sort()
  const signString = sortedKeys.map(key => `${key}=${data[key]}`).join('&')
  const stringToSign = `${signString}&secret=${secret}`
  return crypto.createHash('sha256').update(stringToSign, 'utf8').digest('hex')
}

async function testExchangeAPI() {
  console.log('Testing Coin Exchange API...\n')

  const timestamp = Date.now()
  const requestData = {
    forum_user_id: '1',
    forum_transaction_id: `test_tx_${timestamp}`,
    user_email: TEST_USER_EMAIL,
    coin_amount: 100,
    timestamp: timestamp
  }

  console.log('Request Data:', JSON.stringify(requestData, null, 2))
  
  const signature = generateSignature(requestData, API_SECRET)
  console.log('Signature:', signature, '\n')

  try {
    console.log('Sending request to:', API_URL, '\n')

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature
      },
      body: JSON.stringify(requestData)
    })

    const statusCode = response.status
    const responseText = await response.text()

    console.log('Status Code:', statusCode)
    console.log('Response:', responseText, '\n')

    if (statusCode === 200) {
      console.log('API Test Successful!')
    } else {
      console.log('API Test Failed')
    }

  } catch (error) {
    console.error('Request Failed:', error.message)
  }
}

testExchangeAPI()
