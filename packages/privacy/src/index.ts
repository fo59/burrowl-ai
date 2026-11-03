const emailPattern = /[^\s@]+@[^\s@]+\.[^\s@]+/
const emailPatternGlobal = /[^\s@]+@[^\s@]+\.[^\s@]+/g

export function hasEmail(text:string):boolean {
    return emailPattern.test(text)
}

console.log(hasEmail('furkan@example.com'))
console.log(hasEmail('furkanexample.com'))
console.log(hasEmail('@furkan instagramda'))
console.log(hasEmail('fiyat @ 500 TL'))
console.log(hasEmail('iletisim: ali.veli@gmail.com'))
console.log(hasEmail('FURKAN@mail.com'))
console.log(hasEmail('furkan@gmail.com'))
console.log(hasEmail('a@b.c'))

export function removeEmails(text:string):string {
    return text.replace(emailPatternGlobal, '[email removed]')
}



console.log(removeEmails('ali.veli@gmail.com adresine kayitli hesap'))
console.log(removeEmails('a@x.com ve b@y.com ikisine de yaz'))
console.log(removeEmails('bunda e-posta yok'))


const phonePattern = /((\+90|0)[\s-]?)?(5\d{2})[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})/g

export function removePhones(text:string):string {
    return text.replace(phonePattern, '[phone number removed]')
}

const tcPattern = /\b[1-9]\d{10}\b/g

export function removeTcNumber(text:string):string {
    return text.replace(tcPattern, '[TC number removed]')
}

console.log(removeTcNumber('12345678901'))
console.log(removeTcNumber('1234567890'))
console.log(removeTcNumber('123456789012'))
console.log(removeTcNumber('1234567890a'))
console.log(removeTcNumber('02345678900'))
