// ================= NOTES =================
// The editable "How to Use" notes: defaults, loading, and saving.
// Part of the app script, split out of the old single script.js.
// Load order matters: see the <script> tags in index.html.

const DEFAULT_HOW_TO_USE_NOTES = {
    en: `1. Choose a free time slot and click Apply.
2. Enter the required in-game information and submit the reservation.
3. Waiting means the slot has applicants but no Accepted applicant yet.
4. If you are President, you can open an applicant's details, change status/time, or remove the record.
5. A moved application keeps its previous status and records the move in Time Log.
6. Use the timezone selector to view slot times in your local timezone.`,
    id: `1. Pilih slot waktu yang kosong lalu tekan Ajukan.
2. Isi informasi dalam game yang diperlukan lalu kirim reservasi.
3. Waiting berarti slot memiliki pengajuan tetapi belum ada pengajuan yang Accepted.
4. Jika Anda Presiden, Anda dapat melihat detail, mengubah status/waktu, atau menghapus pengajuan.
5. Pengajuan yang dipindahkan tetap mempertahankan status sebelumnya dan perpindahannya tercatat di Time Log.
6. Gunakan pilihan zona waktu untuk melihat waktu slot sesuai zona waktu Anda.`,
    ph: `1. Pumili ng bakanteng time slot at pindutin ang Mag-apply.
2. Ilagay ang kinakailangang in-game information at isumite ang reservation.
3. Ang Waiting ay nangangahulugang may mga application sa slot pero wala pang Accepted.
4. Kung ikaw ay President, maaari mong tingnan ang details, baguhin ang status/time, o alisin ang record.
5. Ang inilipat na application ay mananatili sa dating status at itatala ang paglipat sa Time Log.
6. Gamitin ang timezone selector para makita ang oras ayon sa iyong local timezone.`,
    cn: `1. 选择空闲时间段，然后点击预约。
2. 填写所需的游戏信息并提交预约。
3. Waiting 表示该时间段已有申请，但还没有 Accepted 申请。
4. 如果您是会长，可以查看详情、修改状态/时间，或删除记录。
5. 移动申请时会保留原状态，并在 Time Log 中记录移动历史。
6. 使用时区选择器可按照您的本地时区查看时间段。`
};

function getDefaultHowToUseNotes() {
    const lang = typeof getLang === 'function' ? getLang() : 'en';
    return DEFAULT_HOW_TO_USE_NOTES[lang] || DEFAULT_HOW_TO_USE_NOTES.en;
}

async function loadHowToUseNotes(force = false) {
    if (!force && howToUseNotesLoaded) return currentHowToUseNotes;
    const client = getSupabase();
    if (!client) {
        currentHowToUseNotes = getDefaultHowToUseNotes();
        howToUseNotesLoaded = true;
        return currentHowToUseNotes;
    }

    const lang = typeof getLang === 'function' ? getLang() : 'en';
    try {
        const { data, error } = await client
            .from('how_to_use_notes')
            .select('content')
            .eq('position', currentPosition)
            .eq('language', lang)
            .maybeSingle();
        if (error) throw error;
        currentHowToUseNotes = data?.content ?? getDefaultHowToUseNotes();
    } catch (err) {
        console.error('Failed to load How to Use notes:', err);
        currentHowToUseNotes = getDefaultHowToUseNotes();
    }
    howToUseNotesLoaded = true;
    return currentHowToUseNotes;
}

async function openHowToUseModal() {
    const modal = document.getElementById('how-to-use-modal');
    const notesEl = document.getElementById('how-to-use-notes');
    const saveBtn = document.getElementById('how-to-use-save-btn');
    if (!modal || !notesEl) return;

    modal.classList.remove('hidden');
    notesEl.value = getDefaultHowToUseNotes();
    notesEl.readOnly = true;
    notesEl.classList.remove('admin-editable');
    if (saveBtn) saveBtn.style.display = isAdmin ? 'inline-block' : 'none';

    const notes = await loadHowToUseNotes();
    if (!modal.classList.contains('hidden')) notesEl.value = notes;
    if (isAdmin) {
        notesEl.readOnly = false;
        notesEl.classList.add('admin-editable');
    }
}

function closeHowToUseModal() {
    const modal = document.getElementById('how-to-use-modal');
    if (modal) modal.classList.add('hidden');
}

async function saveHowToUseNotes() {
    if (!isAdmin) return;
    const client = getSupabase();
    const notesEl = document.getElementById('how-to-use-notes');
    const saveBtn = document.getElementById('how-to-use-save-btn');
    if (!client || !notesEl) return;

    const content = notesEl.value.trim();
    if (!content) {
        showToast(t('toast_how_to_use_empty'), 'warning');
        return;
    }

    const lang = typeof getLang === 'function' ? getLang() : 'en';
    setButtonBusy(saveBtn, true, t('saving_text'));
    try {
        const { error } = await client
            .from('how_to_use_notes')
            .upsert({
                position: currentPosition,
                language: lang,
                content,
                updated_at: new Date().toISOString()
            }, { onConflict: 'position,language' });
        if (error) throw error;
        currentHowToUseNotes = content;
        howToUseNotesLoaded = true;
        showToast(t('toast_how_to_use_saved'), 'success');
        closeHowToUseModal();
    } catch (err) {
        console.error('Failed to save How to Use notes:', err);
        showToast(t('toast_how_to_use_save_failed'), 'error');
    } finally {
        setButtonBusy(saveBtn, false);
    }
}

