const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function chunkToWords(n: number): string {
  if (n === 0) return ''
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '')
  return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + chunkToWords(n % 100) : '')
}

function integerToWords(n: number): string {
  if (n === 0) return 'zero'
  const groups = ['', ' thousand', ' million', ' billion']
  let result = ''
  let groupIndex = 0
  while (n > 0) {
    const chunk = n % 1000
    if (chunk > 0) {
      result = chunkToWords(chunk) + groups[groupIndex] + (result ? ' ' + result : '')
    }
    n = Math.floor(n / 1000)
    groupIndex++
  }
  return result
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Real amount -> words, GBP. Pence dropped entirely when zero (matches the
// reference invoice's own "One thousand & ninety two pounds." with no pence
// clause), otherwise appended as "and N pence".
export function amountToWords(amount: number): string {
  const pounds = Math.floor(Math.round(amount * 100) / 100)
  const pence = Math.round((amount - pounds) * 100)

  const poundsWords = integerToWords(pounds)
  const poundsLabel = pounds === 1 ? 'pound' : 'pounds'

  if (pence === 0) {
    return capitalize(`${poundsWords} ${poundsLabel}`)
  }

  const penceWords = integerToWords(pence)
  const penceLabel = pence === 1 ? 'penny' : 'pence'
  return capitalize(`${poundsWords} ${poundsLabel} and ${penceWords} ${penceLabel}`)
}
