import { setupTestData } from './test-crew-runsheets'

async function run() {
  try {
    console.log('Running data setup only...')
    const data = await setupTestData()
    console.log('Setup success!', data.jobA, data.jobB)
  } catch (err) {
    console.error('Setup failed:', err)
  }
}

run()
