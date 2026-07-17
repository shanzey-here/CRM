import fs from 'fs'
import path from 'path'

console.log('--- Running Office Layout Guard Regression Test ---')

const layoutPath = path.resolve(__dirname, '../src/app/office/layout.tsx')
const layoutContent = fs.readFileSync(layoutPath, 'utf8')

const hasGuard = layoutContent.includes("if (role !== 'tenant_admin' && role !== 'dispatcher')") && 
                 layoutContent.includes("redirect('/login?error=unauthorized_role')")

if (!hasGuard) {
  throw new Error('❌ Layout guard regression detected! The role check for office routes has been altered or removed. Expected strict check for tenant_admin and dispatcher.')
}

console.log('✅ Office layout guard is intact. Crew and customers are strictly prevented from accessing /office routes.')
