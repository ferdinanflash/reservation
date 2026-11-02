// ================= NOTES =================
// The editable "How to Use" notes: defaults, loading, and saving.
// Part of the app script, split out of the old single script.js.
// Load order matters: see the <script> tags in index.html.

const DEFAULT_HOW_TO_USE_NOTES = {
    "en": "For 3475 Players:\n1. Choose a free time slot and click Apply.\n2. Enter the required in-game information and submit the reservation.\n3. Waiting means the slot has applicants but no Accepted applicant yet.\n4. You can add another preferred time slot if this time does not suit you.\n5. The President will choose the player who has more resources.\n6. Please always check the in-game schedule to make sure.\n\n🔽🔽🔽🔽\nFor President:\nIf you are President, you can open an applicant's details, change status/time, or remove the record.\n1. A moved application keeps its previous status and records the move in Time Log.\n2. Use the timezone selector to view slot times in your local timezone.\n3. You can change status between Accepted and Waiting.\n4. You can move a player to another time slot regardless of the applicant's status.\n5. Click 🔍 to see more options in every window and menu.\n6. Time Log for all applicants is available under More options.\n\nMade with ♥️ 3475",
    "id": "Untuk Pemain 3475:\n1. Pilih slot waktu yang kosong, lalu tekan Ajukan.\n2. Masukkan informasi dalam game yang diperlukan, lalu kirim reservasi.\n3. Waiting berarti slot memiliki pelamar, tetapi belum ada pelamar yang berstatus Accepted.\n4. Anda dapat menambahkan slot waktu pilihan lain jika waktu ini tidak cocok.\n5. Presiden akan memilih pemain yang memiliki lebih banyak sumber daya.\n6. Selalu periksa jadwal dalam game untuk memastikan.\n\n🔽🔽🔽🔽\nUntuk Presiden:\nJika Anda Presiden, Anda dapat membuka detail pelamar, mengubah status/waktu, atau menghapus data.\n1. Pengajuan yang dipindahkan tetap mempertahankan status sebelumnya dan perpindahannya dicatat di Time Log.\n2. Gunakan pemilih zona waktu untuk melihat waktu slot sesuai zona waktu lokal Anda.\n3. Anda dapat mengubah status antara Accepted dan Waiting.\n4. Anda dapat memindahkan pemain ke slot waktu lain apa pun status pengajuannya.\n5. Klik 🔍 untuk melihat opsi lainnya di setiap jendela dan menu.\n6. Time Log semua pelamar tersedia melalui opsi More.\n\nDibuat dengan ♥️ 3475",
    "ph": "Para sa mga Manlalaro ng 3475:\n1. Pumili ng bakanteng time slot at pindutin ang Apply.\n2. Ilagay ang kinakailangang impormasyon sa laro at isumite ang reservation.\n3. Ang Waiting ay nangangahulugang may mga aplikante sa slot ngunit wala pang Accepted.\n4. Maaari kang magdagdag ng isa pang gustong time slot kung hindi angkop sa iyo ang oras na ito.\n5. Pipiliin ng President ang manlalarong may mas maraming resources.\n6. Palaging tingnan ang in-game schedule para makasiguro.\n\n🔽🔽🔽🔽\nPara sa President:\nKung ikaw ang President, maaari mong buksan ang detalye ng aplikante, baguhin ang status/oras, o alisin ang record.\n1. Ang inilipat na application ay mananatili sa dating status at itatala ang paglipat sa Time Log.\n2. Gamitin ang timezone selector upang makita ang oras ng slot sa iyong lokal na timezone.\n3. Maaari mong palitan ang status sa pagitan ng Accepted at Waiting.\n4. Maaari mong ilipat ang player sa ibang time slot anuman ang status ng application.\n5. I-click ang 🔍 para makita ang higit pang opsyon sa bawat window at menu.\n6. Makikita ang Time Log ng lahat ng aplikante sa More options.\n\nGinawa nang may ♥️ 3475",
    "cn": "3475 玩家须知：\n1. 选择一个空闲时段并点击“申请”。\n2. 填写所需的游戏内信息并提交预约。\n3. Waiting 表示该时段已有申请者，但尚无申请被 Accepted。\n4. 如果该时间不适合您，可以再添加一个首选时段。\n5. 总统将选择资源更多的玩家。\n6. 请务必查看游戏内日程以确认安排。\n\n🔽🔽🔽🔽\n总统须知：\n如果您是总统，可以打开申请者详情、修改状态/时间，或删除记录。\n1. 移动申请后会保留原状态，并在 Time Log 中记录此次移动。\n2. 使用时区选择器，以本地时区查看时段时间。\n3. 可以在 Accepted 和 Waiting 之间更改状态。\n4. 无论申请者当前状态如何，都可以将其移至其他时段。\n5. 点击 🔍 可查看各窗口和菜单中的更多选项。\n6. 所有申请者的 Time Log 可在 More options 中查看。\n\n用 ♥️ 制作：3475",
    "it": "Per i giocatori di 3475:\n1. Scegli una fascia oraria libera e premi Apply.\n2. Inserisci le informazioni richieste nel gioco e invia la prenotazione.\n3. Waiting significa che ci sono candidati nella fascia, ma nessuno è ancora Accepted.\n4. Puoi aggiungere un'altra fascia oraria preferita se questa non è adatta.\n5. Il Presidente sceglierà il giocatore con più risorse.\n6. Controlla sempre il programma di gioco per confermare.\n\n🔽🔽🔽🔽\nPer il Presidente:\nSe sei il Presidente, puoi aprire i dettagli di un candidato, modificare stato/orario o rimuovere il record.\n1. Una candidatura spostata mantiene lo stato precedente e lo spostamento viene registrato nel Time Log.\n2. Usa il selettore del fuso orario per visualizzare gli orari nel tuo fuso locale.\n3. Puoi cambiare lo stato tra Accepted e Waiting.\n4. Puoi spostare un giocatore in un'altra fascia indipendentemente dallo stato della candidatura.\n5. Premi 🔍 per vedere altre opzioni in ogni finestra e menu.\n6. Il Time Log di tutti i candidati è disponibile in More options.\n\nRealizzato con ♥️ 3475",
    "th": "สำหรับผู้เล่น 3475:\n1. เลือกช่วงเวลาว่างแล้วกด Apply\n2. กรอกข้อมูลในเกมที่จำเป็นแล้วส่งการจอง\n3. Waiting หมายถึงมีผู้สมัครในช่วงเวลานั้นแล้ว แต่ยังไม่มีผู้สมัครที่ได้รับ Accepted\n4. คุณสามารถเพิ่มช่วงเวลาที่ต้องการอีกช่วงได้ หากเวลานี้ไม่สะดวก\n5. ประธานจะเลือกผู้เล่นที่มีทรัพยากรมากกว่า\n6. โปรดตรวจสอบตารางเวลาในเกมเสมอเพื่อยืนยัน\n\n🔽🔽🔽🔽\nสำหรับประธาน:\nหากคุณเป็นประธาน คุณสามารถเปิดรายละเอียดผู้สมัคร เปลี่ยนสถานะ/เวลา หรือลบรายการได้\n1. การย้ายใบสมัครจะคงสถานะเดิมไว้และบันทึกการย้ายใน Time Log\n2. ใช้ตัวเลือกเขตเวลาเพื่อดูเวลาของช่องตามเขตเวลาท้องถิ่น\n3. คุณสามารถเปลี่ยนสถานะระหว่าง Accepted และ Waiting ได้\n4. คุณสามารถย้ายผู้เล่นไปยังช่วงเวลาอื่นได้ไม่ว่าสถานะใบสมัครจะเป็นอย่างไร\n5. กด 🔍 เพื่อดูตัวเลือกเพิ่มเติมในทุกหน้าต่างและเมนู\n6. ดู Time Log ของผู้สมัครทั้งหมดได้ใน More options\n\nสร้างด้วย ♥️ 3475",
    "ru": "Для игроков 3475:\n1. Выберите свободный временной слот и нажмите «Подать заявку».\n2. Введите необходимые игровые данные и отправьте заявку.\n3. Статус Waiting означает, что на слот уже есть заявки, но ещё нет заявок со статусом Accepted.\n4. Если это время вам не подходит, можно добавить ещё один предпочтительный слот.\n5. Президент выберет игрока с большим количеством ресурсов.\n6. Всегда проверяйте расписание в игре, чтобы убедиться в актуальности времени.\n\n🔽🔽🔽🔽\nДля Президента:\nЕсли вы Президент, вы можете открыть данные заявителя, изменить статус/время или удалить запись.\n1. При переносе заявки её прежний статус сохраняется, а перенос записывается в Time Log.\n2. Используйте выбор часового пояса, чтобы видеть время слотов в своём часовом поясе.\n3. Вы можете менять статус между Accepted и Waiting.\n4. Вы можете перенести игрока в другой слот независимо от статуса заявки.\n5. Нажмите 🔍, чтобы увидеть дополнительные параметры во всех окнах и меню.\n6. Time Log всех заявителей доступен в разделе More options.\n\nСделано с ♥️ 3475",
    "fr": "Pour les joueurs de 3475 :\n1. Choisissez un créneau libre et cliquez sur « Apply ».\n2. Saisissez les informations requises dans le jeu, puis envoyez la réservation.\n3. Le statut Waiting signifie qu’il y a des candidats pour ce créneau, mais qu’aucun n’a encore le statut Accepted.\n4. Vous pouvez ajouter un autre créneau préféré si celui-ci ne vous convient pas.\n5. Le Président choisira le joueur qui possède le plus de ressources.\n6. Consultez toujours le calendrier en jeu pour vérifier les horaires.\n\n🔽🔽🔽🔽\nPour le Président :\nSi vous êtes Président, vous pouvez ouvrir les détails d’un candidat, modifier son statut/son horaire ou supprimer l’entrée.\n1. Une candidature déplacée conserve son statut précédent et le déplacement est enregistré dans le Time Log.\n2. Utilisez le sélecteur de fuseau horaire pour afficher les créneaux selon votre heure locale.\n3. Vous pouvez modifier le statut entre Accepted et Waiting.\n4. Vous pouvez déplacer un joueur vers un autre créneau quel que soit le statut de sa candidature.\n5. Cliquez sur 🔍 pour afficher plus d’options dans chaque fenêtre et menu.\n6. Le Time Log de tous les candidats est accessible dans More options.\n\nFait avec ♥️ 3475"
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

