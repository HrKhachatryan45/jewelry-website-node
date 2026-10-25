function showMsg(text, ok) {
  const el = document.getElementById('msg');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  el.classList.toggle('bg-luxe-black', ok !== false);
  el.classList.toggle('bg-red-600', ok === false);
}

function setupUpload() {
  const fileInput = document.getElementById('id_sketch');
  const previewContainer = document.getElementById('image-previews');
  const uploadContainer = document.getElementById('upload-container');
  const uploadLabel = uploadContainer && uploadContainer.querySelector('label');
  const errorText = document.getElementById('upload-error');
  if (!fileInput) return () => [];

  let selectedFiles = [];

  function updateFileInput() {
    const dataTransfer = new DataTransfer();
    selectedFiles.forEach((file) => dataTransfer.items.add(file));
    fileInput.files = dataTransfer.files;

    if (selectedFiles.length > 0) {
      previewContainer.classList.remove('hidden');
      if (selectedFiles.length >= 3) uploadContainer.classList.add('hidden');
      else uploadContainer.classList.remove('hidden');
    } else {
      previewContainer.classList.add('hidden');
      uploadContainer.classList.remove('hidden');
    }
  }

  function handleFiles(files) {
    errorText.classList.add('hidden');
    for (let i = 0; i < files.length; i++) {
      if (selectedFiles.length >= 3) {
        errorText.textContent = 'Կարող եք ընտրել մինչև 3 նկար:';
        errorText.classList.remove('hidden');
        break;
      }
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        errorText.textContent = 'Միայն նկարներ են թույլատրվում (PNG, JPG):';
        errorText.classList.remove('hidden');
        continue;
      }
      selectedFiles.push(file);
      const reader = new FileReader();
      reader.onload = function (e) {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'relative aspect-square rounded-xl overflow-hidden group border border-border/10 bg-section-alt';
        previewDiv.innerHTML = `
          <img src="${e.target.result}" class="w-full h-full object-cover" alt="Preview">
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button type="button" class="remove-btn text-white p-2 hover:text-red-400 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>`;
        const removeBtn = previewDiv.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => {
          const index = selectedFiles.indexOf(file);
          if (index > -1) selectedFiles.splice(index, 1);
          previewDiv.remove();
          updateFileInput();
        });
        previewContainer.appendChild(previewDiv);
      };
      reader.readAsDataURL(file);
    }
    updateFileInput();
  }

  fileInput.addEventListener('change', function () {
    handleFiles(this.files);
  });

  if (uploadLabel) {
    uploadLabel.addEventListener('dragover', function (e) {
      e.preventDefault();
      this.classList.add('border-luxe-black');
      this.classList.remove('border-border/20');
    });
    uploadLabel.addEventListener('dragleave', function (e) {
      e.preventDefault();
      this.classList.remove('border-luxe-black');
      this.classList.add('border-border/20');
    });
    uploadLabel.addEventListener('drop', function (e) {
      e.preventDefault();
      this.classList.remove('border-luxe-black');
      this.classList.add('border-border/20');
      if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    });
  }

  return () => selectedFiles;
}

async function init() {
  const form = document.getElementById('bespoke-form');
  if (!form) return;
  const getFiles = setupUpload();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const files = getFiles();
    if (files && files.length) {
      fd.delete('sketch');
      files.forEach((f) => fd.append('sketch', f));
    }
    const btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = '...'; }
    try {
      const res = await fetch('/api/bespoke', { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        showMsg(data.message || 'Ձեր հայտը ուղարկվեց։', true);
        form.reset();
        const previews = document.getElementById('image-previews');
        if (previews) { previews.innerHTML = ''; previews.classList.add('hidden'); }
        const upload = document.getElementById('upload-container');
        if (upload) upload.classList.remove('hidden');
      } else {
        showMsg(data.error || (data.errors && Object.values(data.errors)[0]) || 'Սխալ', false);
      }
    } catch (err) {
      showMsg('Կապի խափանում', false);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
    }
  };

  if (window.I18N && typeof window.I18N.setLang === 'function') window.I18N.setLang(window.I18N.current);
  if (typeof window.__observeScroll === 'function') window.__observeScroll();
}
init();
