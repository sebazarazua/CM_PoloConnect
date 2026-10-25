/** Discovery metadata/reference indexes are redundant after routing. Editorial rules stay verbatim. */
export function skillCore(markdown:string):string {
 const body=markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'');
 return body.replace(/^## Required references\s*\r?\n[\s\S]*?(?=^## |$(?![\s\S]))/gm,'');
}
