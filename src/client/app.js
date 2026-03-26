// --- 1. 다국어(i18n) 번역 사전 세팅 ---
const i18nDict = {
    ko: {
        title: "EasyQ 매장", subtitle: "모바일 스마트 대기열",
        currentWaitText: "현재 대기:", currentWaitUnit: "팀", // 🚨 신규 추가
        nameLabel: "방문자명", namePlaceholder: "이름을 입력해주세요",
        phoneLabel: "연락처", phonePlaceholder: "전화번호 (예: 010-1234-5678)",
        countLabel: "방문 인원", countPlaceholder: "명",
        btnRegister: "대기 등록하기",
        notice: "* 등록 후 화면을 끄지 마세요. 실시간으로 순서가 업데이트됩니다.",
        statusLabel: "현재 내 대기 순서", turnUnit: "번째",
        statusMessageWait: "곧 입장 순서입니다. 매장 근처에서 대기해주세요.",
        infoTicket: "대기 번호:", infoCount: "등록 인원:", infoCountUnit: "명",
        finalNotice: "순서가 되면 점원이 호명하거나 알림이 울립니다.",
        loading: "처리 중...", alertName: "이름을 입력해주세요.",
        alertPhone: "연락처를 입력해주세요.", alertCount: "인원수를 확인해주세요."
    },
    en: {
        title: "EasyQ Store", subtitle: "Smart Mobile Waitlist",
        currentWaitText: "Currently Waiting:", currentWaitUnit: "groups", // 🚨 신규 추가
        nameLabel: "Visitor Name", namePlaceholder: "Enter your name",
        phoneLabel: "Contact Number", phonePlaceholder: "Phone number (e.g., 0917-123-4567)",
        countLabel: "Number of Guests", countPlaceholder: "Pax",
        btnRegister: "Join Waitlist",
        notice: "* Please keep this screen open. Your turn will be updated in real-time.",
        statusLabel: "Current Place in Line", turnUnit: "th",
        statusMessageWait: "You are almost there. Please wait nearby.",
        infoTicket: "Ticket No:", infoCount: "Guests:", infoCountUnit: "Pax",
        finalNotice: "We will notify you when it's your turn.",
        loading: "Processing...", alertName: "Please enter your name.",
        alertPhone: "Please enter your contact number.", alertCount: "Please check the number of guests."
    }
};

const userLang = (navigator.language || navigator.userLanguage).startsWith('ko') ? 'ko' : 'en';
const lang = i18nDict[userLang];

function applyLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (lang[key]) el.innerText = lang[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (lang[key]) el.placeholder = lang[key];
    });
    if (userLang === 'en') document.body.style.fontSize = "15px";
}

// --- 2. 기본 로직 세팅 ---
const urlParams = new URLSearchParams(window.location.search);
const gasAppId = urlParams.get('id');

const el = {
    shopName: document.getElementById('shop-name'),
    registerSection: document.getElementById('register-section'),
    statusSection: document.getElementById('status-section'),
    shopWaitCount: document.getElementById('shop-wait-count'), // 🚨 신규 추가
    userName: document.getElementById('user-name'),
    userPhone: document.getElementById('user-phone'),
    userCount: document.getElementById('user-count'),
    btnRegister: document.getElementById('btn-register'),
    myTurn: document.getElementById('my-turn'),
    myTicketNumber: document.getElementById('my-ticket-number'),
    myCount: document.getElementById('my-count'),
    loading: document.getElementById('loading')
};

const STORAGE_KEY = `easyq_ticket_${gasAppId}`;
let myTicketInfo = null;
let statusPollingTimer = null;
let hasCalledSoundPlayed = false; 

async function init() {
    applyLanguage(); 
    if (!gasAppId) { alert("Invalid QR Code."); return; }

    const savedTicket = localStorage.getItem(STORAGE_KEY);
    if (savedTicket) {
        myTicketInfo = JSON.parse(savedTicket);
        switchToStatusScreen();
        startStatusPolling();
    } else {
        // 🚨 신규: 티켓이 없으면(처음 접속하면) 현재 대기 인원 불러오기
        fetchShopInfo();
    }
}

// 🚨 신규: 현재 대기 인원 가져오는 함수
function fetchShopInfo() {
    EasyQApi.request(gasAppId, { action: 'getShopInfo' })
        .then(data => {
            if (data.status === 'success') {
                el.shopWaitCount.innerText = data.waitCount;
            }
        });
}

// --- 3. 대기 등록 (연락처 포함) ---
async function registerWaiting() {
    const name = el.userName.value.trim();
    const phone = el.userPhone.value.trim();
    const count = parseInt(el.userCount.value);

    if (!name) { alert(lang.alertName); el.userName.focus(); return; }
    if (!phone) { alert(lang.alertPhone); el.userPhone.focus(); return; }
    if (!count || count < 1) { alert(lang.alertCount); el.userCount.focus(); return; }

    showLoading(true);

    try {
        const data = await EasyQApi.request(gasAppId, {
            action: 'register',
            name: name,
            phone: phone,
            count: count
        });

        if (data.status === 'success') {
            myTicketInfo = {
                ticketId: data.ticketId,
                ticketNumber: data.ticketNumber,
                name: name,
                count: count
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(myTicketInfo));
            switchToStatusScreen();
            startStatusPolling();
        }
    } catch (error) {
        alert("Network Error.");
    } finally {
        showLoading(false);
    }
}

// --- 4. 실시간 상태 확인 (Pusher + Polling 하이브리드) ---
function startStatusPolling() {
    checkMyTurn();
    if (typeof EasyQPusher !== 'undefined') {
        EasyQPusher.init(gasAppId, () => checkMyTurn());
    } else {
        statusPollingTimer = setInterval(checkMyTurn, 15000);
    }
}

function checkMyTurn() {
    if (!myTicketInfo) return;

    EasyQApi.request(gasAppId, { action: 'getMyStatus', ticketId: myTicketInfo.ticketId })
        .then(data => {
            if (data.status === 'success') {
                el.myTurn.innerText = data.currentTurn;
                
                if (data.ticketStatus === '호출') {
                    if (!hasCalledSoundPlayed) {
                        const sound = document.getElementById('alert-sound');
                        if (sound) sound.play().catch(e => console.log("소리 재생 실패", e));
                        if (navigator.vibrate) navigator.vibrate([200, 100, 200]); 
                        hasCalledSoundPlayed = true; 
                    }
                    document.querySelector('.status-label').innerText = userLang === 'ko' ? "🔔 차례가 되었습니다!" : "🔔 It's your turn!";
                    document.querySelector('.status-label').style.color = "#d32f2f";
                    document.querySelector('.turn-number').innerHTML = `<span style="font-size:30px;color:#d32f2f;">${userLang === 'ko' ? '지금 바로 입장하세요' : 'Please proceed to the store'}</span>`;
                    document.getElementById('status-message').innerText = userLang === 'ko' ? "카운터로 오셔서 점원에게 화면을 보여주세요." : "Please show this screen to the staff.";
                    document.getElementById('status-message').style.color = "#d32f2f";
                } 
                else if (data.ticketStatus === '입장 완료') {
                    handleAdmission();
                }
                else if (data.ticketStatus === '취소') {
                    if (statusPollingTimer) clearInterval(statusPollingTimer);
                    localStorage.removeItem(STORAGE_KEY);
                    
                    document.querySelector('.status-label').innerText = userLang === 'ko' ? "안내" : "Notice";
                    document.querySelector('.status-label').style.color = "#777";
                    document.querySelector('.turn-number').innerHTML = `<span style="font-size:30px;color:#777;">${userLang === 'ko' ? '대기 취소됨' : 'Waitlist Canceled'}</span>`;
                    document.getElementById('status-message').innerText = userLang === 'ko' ? "대기가 취소되었습니다. 매장에 문의해주세요." : "Your waitlist has been canceled. Please contact the store.";
                    document.getElementById('status-message').style.color = "#777";
                }
            }
        });
}

function switchToStatusScreen() {
    el.registerSection.classList.add('hidden');
    el.statusSection.classList.remove('hidden');
    el.myTicketNumber.innerText = myTicketInfo.ticketNumber;
    el.myCount.innerText = myTicketInfo.count;
}

function handleAdmission() {
    if (statusPollingTimer) clearInterval(statusPollingTimer);
    localStorage.removeItem(STORAGE_KEY);
    
    document.querySelector('.status-label').innerText = userLang === 'ko' ? "입장 완료" : "Admitted";
    document.querySelector('.turn-number').innerHTML = `<span style="font-size:30px;color:#2e7d32;">${userLang === 'ko' ? '맛있게 드세요!' : 'Enjoy your meal!'}</span>`;
    document.getElementById('status-message').innerText = userLang === 'ko' ? "입장 처리가 완료되었습니다." : "Your admission is complete.";
    document.getElementById('status-message').style.color = "#2e7d32";
}

function showLoading(isShow) {
    if (isShow) el.loading.classList.remove('hidden');
    else el.loading.classList.add('hidden');
}

el.btnRegister.addEventListener('click', registerWaiting);
init();
