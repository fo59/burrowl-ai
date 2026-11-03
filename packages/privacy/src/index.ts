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



const phonePattern = /(\+90|0)?[\s-]?(5\d{2})[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})/g

export function removePhones(text:string):string {
    return text.replace(phonePattern, '[phone number removed]')
}

console.log('--- telefon ---')
console.log(removePhones('beni 0532 123 45 67 numarasindan ara'))
console.log(removePhones('numaram 05321234567'))
console.log(removePhones('+90 532 123 45 67 kimin numarasi'))
console.log(removePhones('0532-123-45-67 kayitli mi'))
console.log(removePhones('2026 yili fiyatlari'))
console.log(removePhones('iphone 15 fiyati 50000 TL'))
