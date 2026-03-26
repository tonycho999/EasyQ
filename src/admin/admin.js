// --- 1. 다국어(i18n) 번역 사전 세팅 ---
const i18nDict = {
    ko: {
        title: "EasyQ 매장 관리", btnRefresh: "🔄 새로고침",
        tabWalkin: "🙋‍♂️ 홀 손님 대기열", tabRider: "🛵 배달 기사 픽업",
        emptyWalkin: "현재 대기 중인 손님이 없습니다.", emptyRider: "현재 대기 중인 기사님이 없습니다.",
        loading: "데이터를 불러오는 중...", alertInvalid: "올바르지 않은 관리자 링크입니다.",
        alertError: "상태 변경에 실패했습니다. 다시 시도해주세요.",
        badgeWait: "대기", badgeCount: "총", badgeCountUnit: "명",
        btnCall: "🔔 호출", btnAdmit: "✅ 입장 완료", btnCancel: "취소",
        riderOrderNo: "주문번호:", btnFoodReady: "✅ 조리 완료 (호출)", btnPickedUp: "전달 완료",
        noPhone: "번호 없음"
    },
    en: {
        title: "EasyQ Store Admin", btnRefresh: "🔄 Refresh",
        tabWalkin: "🙋‍♂️ Walk-in Waitlist", tabRider: "🛵 Rider Pick-up",
        emptyWalkin: "No customers currently waiting.", emptyRider: "No riders currently waiting.",
        loading: "Loading data...", alertInvalid: "Invalid admin link.",
        alertError: "Failed to update status. Please try again.",
        badgeWait: "Wait #", badgeCount: "Total", badgeCountUnit: "pax",
        btnCall: "🔔 Call", btnAdmit: "✅ Admitted", btnCancel: "Cancel",
        riderOrderNo: "Order No:", btnFoodReady: "✅ Ready (Call)", btnPickedUp: "Picked Up",
        noPhone: "No Number"
    }
};

const userLang = (navigator.language || navigator.userLanguage).startsWith('ko') ? 'ko' : 'en';
const lang = i18nDict[userLang];

function applyLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (lang[key]) el.innerText = lang[key];
    });
}

// --- 2. 기본 세팅 ---
const urlParams = new URLSearchParams(window.location.search);
const gasAppId = urlParams.get('id');

if (!gasAppId) { alert(lang.alertInvalid); }

const el = {
    tabWalkin: document.getElementById('tab-walkin'),
    tabRider: document.getElementById('tab-rider'),
    listWalkin: document.getElementById('list-walkin'),
    listRider: document.getElementById('list-rider'),
    btnRefresh: document.getElementById('btn-refresh'),
    loading: document.getElementById('loading'),
    alertSound: document.getElementById('alert-sound')
};

// 시작 시 언어 변환
applyLanguage();

// --- 3. Pusher 실시간 알림 ---
EasyQPusher.init(gasAppId, (data) => {
    el.alertSound.play().catch(e => console.log("Auto-play prevented. Please interact with the screen first."));
    fetchList();
});

// --- 4. 탭 전환 로직 ---
el.tabWalkin.addEventListener('click', () => {
    el.tabWalkin.classList.add('active'); el.tabRider.classList.remove('active');
    el.listWalkin.classList.remove('hidden'); el.listRider.classList.add('hidden');
});

el.tabRider.addEventListener('click', () => {
    el.tabRider.classList.add('active'); el.tabWalkin.classList.remove('active');
    el.listRider.classList.remove('hidden'); el.listWalkin.classList.add('hidden');
});

// --- 5. 리스트 가져오기 ---
async function fetchList() {
    el.loading.classList.remove('hidden');
    try {
        const data = await EasyQApi.request(gasAppId, { action: 'getAdminList' });
        if (data.status === 'success') {
            renderWalkinList(data.walkinList);
            renderRiderList(data.riderList);
        }
    } catch (error) {
        console.error("Fetch failed:", error);
    } finally {
        el.loading.classList.add('hidden');
    }
}

// --- 6. 화면에 카드 그리기 ---
function renderWalkinList(list) {
    if (list.length === 0) {
        el.listWalkin.innerHTML = `<div class="empty-msg">${lang.emptyWalkin}</div>`;
        return;
    }
    
    let html = '';
    list.forEach((item, index) => {
        // 백엔드에서 받아온 전화번호(phone)가 없으면 '번호 없음' 출력
        const phoneText = item.phone ? item.phone : lang.noPhone;

        html += `
            <div class="ticket-card">
                <div class="card-info">
                    <span class="turn-badge">${lang.badgeWait} ${index + 1}</span>
                    <span class="ticket-detail">${lang.badgeCount} ${item.count}${lang.badgeCountUnit} / ${item.time}</span>
                </div>
                <div class="ticket-name">🙋‍♂️ ${item.name} <span style="font-size: 14px; color: #666; margin-left: 10px;">📞 ${phoneText}</span></div>
                <div class="card-actions">
                    <button class="btn btn-call" onclick="updateStatus('${item.id}', '호출')">${lang.btnCall}</button>
                    <button class="btn btn-admit" onclick="updateStatus('${item.id}', '입장 완료')">${lang.btnAdmit}</button>
                    <button class="btn btn-cancel" onclick="updateStatus('${item.id}', '취소')">${lang.btnCancel}</button>
                </div>
            </div>
        `;
    });
    el.listWalkin.innerHTML = html;
}

function renderRiderList(list) {
    if (list.length === 0) {
        el.listRider.innerHTML = `<div class="empty-msg">${lang.emptyRider}</div>`;
        return;
    }

    let html = '';
    list.forEach((item, index) => {
        html += `
            <div class="ticket-card" style="border-left: 4px solid #ff9800;">
                <div class="card-info">
                    <span class="turn-badge" style="background-color: #333;">${item.platform}</span>
                    <span class="ticket-detail">${item.time}</span>
                </div>
                <div class="ticket-name">🛵 ${lang.riderOrderNo} ${item.orderNumber}</div>
                <div class="card-actions">
                    <button class="btn btn-call" style="background-color: #2e7d32;" onclick="updateStatus('${item.id}', '픽업 요망')">${lang.btnFoodReady}</button>
                    <button class="btn btn-cancel" onclick="updateStatus('${item.id}', '픽업 완료')">${lang.btnPickedUp}</button>
                </div>
            </div>
        `;
    });
    el.listRider.innerHTML = html;
}

// --- 7. 상태 업데이트 ---
async function updateStatus(ticketId, newStatus) {
    el.loading.classList.remove('hidden');
    try {
        await EasyQApi.request(gasAppId, { action: 'updateStatus', ticketId: ticketId, status: newStatus });
        fetchList();
    } catch (error) {
        alert(lang.alertError);
    }
}

el.btnRefresh.addEventListener('click', fetchList);
fetchList();
