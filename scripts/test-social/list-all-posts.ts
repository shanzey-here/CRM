import { config } from 'dotenv'
config({ path: '.env.local' })

const API_KEY = process.env.ZERNIO_API_KEY!
const PROFILE_ID = '6a674be29864163b359b763c'

async function main() {
  const res = await fetch(`https://zernio.com/api/v1/posts?profileId=${PROFILE_ID}&limit=20`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  })
  const data = await res.json()
  console.log('status:', res.status)
  for (const post of data.posts ?? []) {
    console.log(`\n--- post ${post._id} ---`)
    console.log('top-level status:', post.status)
    console.log('content:', post.content?.slice(0, 60))
    console.log('platforms:', JSON.stringify((post.platforms ?? []).map((p: any) => ({ platform: p.platform, status: p.status, publishAttempts: p.publishAttempts, postUrl: p.postUrl, error: p.error }))))
  }
}
main()
