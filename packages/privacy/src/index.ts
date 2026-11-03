
export function hasEmail(text:string):boolean {
    return text.includes('@')  
}

console.log(hasEmail('furkan@example.com'))
console.log(hasEmail('furkanexample.com'))

