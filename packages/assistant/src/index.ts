const yearPattern = /\b(19|20)\d{2}\b/
const keywordPattern = /\b(\bbugün|\bfiyat|\bgüncel|\bson\b|\bhaber|\bborsa)/i


export function needsSearch(question: string): boolean{
    return yearPattern.test(question) || keywordPattern.test(question)
    
}