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
    return text.replace(emailPatternGlobal, 'e-mail')
}



console.log(removeEmails('ali.veli@gmail.com adresine kayitli hesap'))
console.log(removeEmails('a@x.com ve b@y.com ikisine de yaz'))
console.log(removeEmails('bunda e-posta yok'))


