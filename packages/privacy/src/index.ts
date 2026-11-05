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
export interface SanitizeResult{
    text: string
    removed: string[]
}

export function sanitizeQuery(text: string): SanitizeResult {
    const removed: string[] = []
    let result = text

    const withoutEmails = removeEmails(result)
    if (withoutEmails !== result){
        removed.push('email')
    }
    result = withoutEmails

    const withoutIban = removeIbans(result)
        if(withoutIban !== result){
            removed.push('iban')
        }
    result = withoutIban

    const withoutPhoneNumbers = removePhones(result)
        if (withoutPhoneNumbers !== result) {
            removed.push('phone')
    }
    result = withoutPhoneNumbers
    
    const withoutTc = removeTcNumber(result)
        if(withoutTc !== result){
            removed.push('tc')
        }
    result = withoutTc
    
    return{text: result, removed:removed}
}