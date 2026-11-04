const emailPattern = /[^\s@]+@[^\s@]+\.[^\s@]+/
const emailPatternGlobal = /[^\s@]+@[^\s@]+\.[^\s@]+/g

export function hasEmail(text:string):boolean {
    return emailPattern.test(text)
}

export function removeEmails(text:string):string {
    return text.replace(emailPatternGlobal, '[email removed]')
}

const phonePattern = /((\+90|0)[\s-]?)?(5\d{2})[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})/g

export function removePhones(text:string):string {
    return text.replace(phonePattern, '[phone number removed]')
}

const tcPattern = /\b[1-9]\d{10}\b/g

export function removeTcNumber(text:string):string {
    return text.replace(tcPattern, '[TC number removed]')
}

const ibanPattern = /(\bTR)\d{2}(\s?\d{4}){5}\s?\d{2}\b/gi

export function removeIbans(text:string):string {
    return text.replace(ibanPattern,'[IBAN removed]')
}