'use strict';

(() => {
  const form = document.getElementById('intake');
  if (!form) return;
  const recipient = 'hello@moondogapps.com';
  const status = document.getElementById('form-status');
  const prepared = document.getElementById('prepared');

  function requestText() {
    ['name', 'email', 'company', 'app', 'problem'].forEach(name => {
      const field = form.elements.namedItem(name);
      field.setCustomValidity(field.value.trim() ? '' : 'Enter a value. Spaces alone are not enough.');
    });
    const problem = form.elements.namedItem('problem');
    if (problem.value.trim() && problem.value.trim().length < 20) {
      problem.setCustomValidity('Describe the problem in at least 20 characters.');
    }
    if (!form.reportValidity()) {
      status.classList.add('error');
      status.textContent = 'Complete the required fields before preparing your request.';
      return null;
    }
    const data = new FormData(form);
    return [
      'App release diagnosis request', '',
      `Name: ${data.get('name').trim()}`,
      `Email: ${data.get('email').trim()}`,
      `Company: ${data.get('company').trim()}`,
      `Package: ${data.get('package')}`,
      `Technology: ${data.get('technology')}`,
      `App: ${data.get('app').trim()}`,
      `Target release date: ${data.get('deadline') || 'Not set'}`, '',
      'Problem:', data.get('problem').trim(), '',
      'I can authorize work on this app.',
      'I understand that diagnosis costs USD 250 after fit confirmation.',
      'Please confirm fit, capacity, payment details, and the proposed start date.'
    ].join('\n');
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const body = requestText();
    if (!body) return;
    document.getElementById('request-text').value = body;
    const url = `mailto:${recipient}?subject=${encodeURIComponent('App release diagnosis request')}&body=${encodeURIComponent(body)}`;
    document.getElementById('email-draft').href = url;
    prepared.hidden = false;
    status.classList.remove('error');
    status.textContent = 'Your request is ready below. Nothing has been sent. Open your email draft to review and send it.';
    document.getElementById('request-text').focus();
  });

  document.getElementById('download').addEventListener('click', () => {
    const body = requestText();
    if (!body) return;
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'app-release-diagnosis-request.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.classList.remove('error');
    status.textContent = 'Request download started. Attach it to an email. Nothing has been sent.';
  });

  function invalidateDraft() {
    Array.from(form.elements).forEach(field => {
      if (typeof field.setCustomValidity === 'function') field.setCustomValidity('');
    });
    if (!prepared.hidden) {
      prepared.hidden = true;
      document.getElementById('email-draft').removeAttribute('href');
      status.textContent = 'Your details changed. Prepare the email again to update your request.';
    }
  }

  document.querySelectorAll('[data-package]').forEach(link => {
    link.addEventListener('click', () => {
      form.elements.namedItem('package').value = link.dataset.package;
      invalidateDraft();
    });
  });
  form.addEventListener('input', invalidateDraft);
  form.addEventListener('change', invalidateDraft);
})();
