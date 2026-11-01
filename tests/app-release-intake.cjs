const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(process.argv[2] || path.join(__dirname, '../hire/repair.js'), 'utf8');
let checks = 0;

function fixture() {
  const listeners = {};
  const nodes = {};
  const values = {
    name: 'Test & Co', email: 'test@example.com', company: 'Demo Studio',
    package: 'Diagnosis', technology: 'SwiftUI / Swift', app: 'A+B & App',
    problem: 'The purchase completes, but export stays locked.\nUnicode: é ✓',
    deadline: '', permission: 'on'
  };
  const fields = Object.entries(values).map(([name, value]) => ({
    name, value, validityMessage: '', setCustomValidity(message) { this.validityMessage = message; }
  }));
  fields.namedItem = name => fields.find(field => field.name === name);
  fields.package = fields.namedItem('package');
  function node(id) {
    return nodes[id] ||= {
      value: '', hidden: id === 'prepared', href: '', textContent: '',
      classList: { add() {}, remove() {} }, focus() { this.focused = true; },
      removeAttribute(key) { delete this[key]; },
      addEventListener(type, callback) { listeners[id + ':' + type] = callback; }
    };
  }
  const form = node('intake');
  form.elements = fields;
  form.reportValidity = () => !fields.some(field => field.validityMessage);
  const packageLink = node('packageLink');
  packageLink.dataset = { package: 'Diagnosis and repair' };
  const downloads = [];
  const blobs = [];
  class FakeFormData { get(key) { return fields.namedItem(key).value; } }
  vm.runInNewContext(source, {
    document: {
      getElementById: node,
      querySelectorAll: () => [packageLink],
      createElement: () => ({ click() { downloads.push(this.download); }, remove() {} }),
      body: { appendChild() {} }
    },
    FormData: FakeFormData,
    Blob,
    URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:test'; }, revokeObjectURL() {} },
    setTimeout: callback => callback()
  });
  const submit = () => listeners['intake:submit']({ preventDefault() {} });
  return { nodes, fields, listeners, form, submit, downloads, blobs };
}

(async () => {
  let f = fixture();
  f.submit();
  let uri = new URL(f.nodes['email-draft'].href);
  assert.equal(uri.protocol, 'mailto:');
  assert.equal(uri.pathname, 'roman.kopaliani@gmail.com');
  assert.match(uri.searchParams.get('body'), /A\+B & App/);
  assert.match(uri.searchParams.get('body'), /Unicode: é ✓/);
  assert.match(f.nodes['form-status'].textContent, /Nothing has been sent/);
  assert.equal(f.nodes.prepared.hidden, false);
  checks++; console.log('PASS: email draft preserves special characters and states that nothing was sent.');

  f.listeners['intake:input']();
  assert.equal(f.nodes.prepared.hidden, true);
  assert.equal(f.nodes['email-draft'].href, undefined);
  checks++; console.log('PASS: changed input invalidates the previous draft.');

  f = fixture(); f.form.reportValidity = () => false; f.submit();
  assert.equal(f.nodes.prepared.hidden, true);
  assert.match(f.nodes['form-status'].textContent, /required fields/);
  checks++; console.log('PASS: invalid form cannot prepare a draft.');

  f = fixture(); f.fields.namedItem('name').value = '   '; f.submit();
  assert.equal(f.nodes.prepared.hidden, true);
  checks++; console.log('PASS: whitespace-only required input is rejected.');

  f = fixture(); f.fields.namedItem('problem').value = ' short '; f.submit();
  assert.equal(f.nodes.prepared.hidden, true);
  checks++; console.log('PASS: short problem descriptions are rejected after trimming.');

  f = fixture(); f.listeners['packageLink:click'](); f.submit();
  uri = new URL(f.nodes['email-draft'].href);
  assert.match(uri.searchParams.get('body'), /Package: Diagnosis and repair/);
  checks++; console.log('PASS: repair CTA selects the correct package.');

  f = fixture(); f.submit(); f.listeners['packageLink:click']();
  assert.equal(f.nodes.prepared.hidden, true);
  assert.equal(f.nodes['email-draft'].href, undefined);
  f.submit();
  assert.match(new URL(f.nodes['email-draft'].href).searchParams.get('body'), /Package: Diagnosis and repair/);
  checks++; console.log('PASS: package CTA invalidates an already prepared draft.');

  f = fixture(); f.submit(); f.listeners['intake:change']();
  assert.equal(f.nodes.prepared.hidden, true);
  assert.equal(f.nodes['email-draft'].href, undefined);
  checks++; console.log('PASS: select change invalidates the previous draft.');

  f = fixture(); f.listeners['download:click']();
  assert.deepEqual(f.downloads, ['app-release-diagnosis-request.txt']);
  assert.match(await f.blobs[0].text(), /USD 250/);
  assert.match(await f.blobs[0].text(), /Target release date: Not set/);
  checks++; console.log('PASS: download contains the enquiry and no invented deadline.');

  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|sendBeacon|localStorage|sessionStorage)\b/);
  checks++; console.log('PASS: intake script contains no network sender or browser storage.');
  console.log(`${checks} checks passed. These use a DOM fixture; they do not prove browser rendering or email delivery.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
