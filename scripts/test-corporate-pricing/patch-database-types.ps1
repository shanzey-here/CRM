$ErrorActionPreference = "Stop"
$path = "src/types/database.types.ts"
[string[]]$lines = Get-Content -Path $path -Encoding Unicode
$list = [System.Collections.Generic.List[string]]::new()
$list.AddRange([string[]]$lines)

# Sanity-check anchors before mutating anything.
if ($list[1978] -ne '          signature_name?: string | null') { throw "anchor mismatch at 1979 (0-idx 1978): $($list[1978])" }
if ($list[1975] -ne '          lead_id?: string | null') { throw "anchor mismatch at 1976 (0-idx 1975): $($list[1975])" }
if ($list[1952] -ne '          signature_name?: string | null') { throw "anchor mismatch at 1953 (0-idx 1952): $($list[1952])" }
if ($list[1949] -ne '          lead_id?: string | null') { throw "anchor mismatch at 1950 (0-idx 1949): $($list[1949])" }
if ($list[1926] -ne '          signature_name: string | null') { throw "anchor mismatch at 1927 (0-idx 1926): $($list[1926])" }
if ($list[1923] -ne '          lead_id: string | null') { throw "anchor mismatch at 1924 (0-idx 1923): $($list[1923])" }
if ($list[453] -ne '      contacts: {') { throw "anchor mismatch at 454 (0-idx 453): $($list[453])" }

# Descending order of original 1-indexed line number so earlier (lower)
# insertion points remain valid at the position computed from the original file.
$list.Insert(1979, '          standard_price: number | null')
$list.Insert(1976, '          negotiated_discount_percent: number | null')
$list.Insert(1953, '          standard_price?: number | null')
$list.Insert(1950, '          negotiated_discount_percent?: number | null')
$list.Insert(1927, '          standard_price?: number | null')
$list.Insert(1924, '          negotiated_discount_percent?: number | null')

$newTable = @(
  '      contact_pricing_overrides: {'
  '        Row: {'
  '          contact_id: string'
  '          created_at: string'
  '          created_by: string | null'
  '          discount_percent: number'
  '          id: string'
  '          is_active: boolean'
  '          notes: string | null'
  '          tenant_id: string'
  '          updated_at: string | null'
  '        }'
  '        Insert: {'
  '          contact_id: string'
  '          created_at?: string'
  '          created_by?: string | null'
  '          discount_percent: number'
  '          id?: string'
  '          is_active?: boolean'
  '          notes?: string | null'
  '          tenant_id: string'
  '          updated_at?: string | null'
  '        }'
  '        Update: {'
  '          contact_id?: string'
  '          created_at?: string'
  '          created_by?: string | null'
  '          discount_percent?: number'
  '          id?: string'
  '          is_active?: boolean'
  '          notes?: string | null'
  '          tenant_id?: string'
  '          updated_at?: string | null'
  '        }'
  '        Relationships: ['
  '          {'
  '            foreignKeyName: "contact_pricing_overrides_contact_fk"'
  '            columns: ["contact_id", "tenant_id"]'
  '            isOneToOne: false'
  '            referencedRelation: "contacts"'
  '            referencedColumns: ["id", "tenant_id"]'
  '          },'
  '          {'
  '            foreignKeyName: "contact_pricing_overrides_created_by_fkey"'
  '            columns: ["created_by"]'
  '            isOneToOne: false'
  '            referencedRelation: "users"'
  '            referencedColumns: ["id"]'
  '          },'
  '          {'
  '            foreignKeyName: "contact_pricing_overrides_tenant_id_fkey"'
  '            columns: ["tenant_id"]'
  '            isOneToOne: false'
  '            referencedRelation: "tenants"'
  '            referencedColumns: ["id"]'
  '          },'
  '        ]'
  '      }'
)
$list.InsertRange(453, [string[]]$newTable)

Set-Content -Path $path -Value $list -Encoding Unicode -NoNewline:$false
Write-Output "Patched database.types.ts successfully. New line count: $($list.Count)"
