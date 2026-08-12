import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve('src');
const files = [];
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.name.endsWith('.tsx')) files.push(target);
});
walk(root);

const failures = [];
for (const file of files) {
    const sourceText = fs.readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node) => {
        if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'Button') {
            const attributes = node.openingElement.attributes.properties;
            const valueOf = (name) => attributes.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === name)?.initializer?.getText(source) ?? '';
            const isIcon = valueOf('size').includes('icon');
            const hasName = Boolean(valueOf('aria-label') || valueOf('title') || node.children.some((child) => child.getText(source).includes('sr-only')));
            if (isIcon && !hasName) {
                const position = source.getLineAndCharacterOfPosition(node.getStart(source));
                failures.push(`${path.relative(process.cwd(), file)}:${position.line + 1}`);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
}

if (failures.length) {
    console.error(`Erişilebilir adı olmayan ${failures.length} ikon butonu bulundu:\n${failures.join('\n')}`);
    process.exitCode = 1;
} else {
    console.log(`Erişilebilirlik denetimi başarılı: ${files.length} TSX dosyasında etiketsiz ikon butonu yok.`);
}
