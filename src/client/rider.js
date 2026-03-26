// --- 1. 다국어(i18n) 번역 사전 세팅 ---
const i18nDict = {
    ko: {
        title: "EasyQ 매장", subtitle: "🛵 배달 기사 전용",
        platformLabel: "배달 플랫폼 선택", optionOther: "기타 (Other)",
        orderNumLabel: "주문번호 (마지막 4자리)", orderNumPlaceholder: "예: 1234",
        btnRegister: "픽업 대기 등록",
        notice: "* 매장 밖에서 대기해주세요. 음식이 준비되면 알려드립니다.",
        statusLabel: "현재 조리 상태", cookingStatus: "🍳 조리 중...",
        statusMessageWait: "조리 중입니다. 매장 밖에서 대기해주세요.",
        infoPlatform: "플랫폼:", infoOrderNo: "주문번호:",
        finalNotice: "아직 매장에 들어오지 마세요.<br>'READY(완료)' 신호를 기다려주세요!",
        loading: "처리 중...", alertOrderNum: "주문번호를 입력해주세요."
    },
    en: {
        title: "EasyQ Store", subtitle: "🛵 Delivery Rider Only",
        platformLabel: "Platform", optionOther: "Other",
        orderNumLabel: "Order Number (Last 4 digits)", orderNumPlaceholder: "e.g., GF-1234 or 1234",
        btnRegister: "Register Pick-up",
        notice: "* Please wait outside. We will notify you when the food is ready.",
        statusLabel: "Current Status", cookingStatus: "🍳 Preparing...",
        statusMessageWait: "Preparing your order. Please wait outside.",
        infoPlatform: "Platform:", infoOrderNo: "Order No:",
        finalNotice: "Do not enter the store yet.<br>Wait for the 'READY' signal!",
        loading: "Processing...", alertOrderNum: "Please enter the order number."
    }
};

const userLang = (navigator.language || navigator.userLanguage).startsWith('ko') ? 'ko' : 'en';
const lang = i18nDict[userLang];

function applyLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        // innerHTML을 사용해야 <br> 같은 태그가 정상적으로 번역 적용됨
        if (lang[key]) el.innerHTML = lang[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (lang[key]) el.placeholder = lang[key];
    });
}

// --- 2. 기본 세팅 및 전역 변수 ---
const urlParams = new URLSearchParams(window.location.search);
const gasAppId = urlParams.get('id');

const STORAGE_KEY = `easyq_rider_${gasAppId}`;
let myTicketInfo = null;
let statusPollingTimer = null;
let hasReadySoundPlayed = false; // 🚨 소리 중복 재생 방지용 변수 추가됨!

async function init() {
    applyLanguage(); // 시작 시 언어 변환 실행
    if (!gasAppId) { alert("Invalid QR Code."); return; }

    const savedTicket = localStorage.getItem(STORAGE_KEY);
    if (savedTicket) {
        myTicketInfo = JSON.parse(savedTicket);
        switchToStatusScreen();
        startStatusPolling();
    }
}

// --- 3. 기사 픽업 등록 ---
async function registerWaiting() {
    const platform = document.getElementById('platform').value;
    const orderNumber = document.getElementById('order-number').value.trim();

    if (!orderNumber) { alert(lang.alertOrderNum); return; }

    showLoading(true);

    try {
        const data = await EasyQApi.request(gasAppId, {
            action: 'registerRider',
            platform: platform,
            orderNumber: orderNumber
        });

        if (data.status === 'success') {
            myTicketInfo = {
                ticketId: data.ticketId,
                platform: platform,
                orderNumber: orderNumber
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

// --- 4. 실시간 상태 확인 (Pusher 연동) ---
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

    EasyQApi.request(gasAppId, { action: 'getRiderStatus', ticketId: myTicketInfo.ticketId })
        .then(data => {
            if (data.status === 'success') {
                
                if (data.ticketStatus === '픽업 요망') {
                    // 🚨 조리 완료 시 딱 한 번만 소리 및 진동 울리기
                    if (!hasReadySoundPlayed) {
                        const sound = document.getElementById('alert-sound');
                        if (sound) sound.play().catch(e => console.log("소리 재생 실패", e));
                        
                        if (navigator.vibrate) navigator.vibrate([200, 100, 200]); // 진동 추가
                        
                        hasReadySoundPlayed = true;
                    }
                    handleFoodReady();
                    
                } else if (data.ticketStatus === '픽업 완료' || data.ticketStatus === '취소') {
                    // 🚨 사장님이 전달 완료/취소를 누르면 화면 리셋
                    if (statusPollingTimer) clearInterval(statusPollingTimer);
                    localStorage.removeItem(STORAGE_KEY);
                    alert(userLang === 'ko' ? "처리가 완료되었습니다." : "Order completed.");
                    location.reload(); 
                }
                
            }
        });
}

// --- 5. UI 업데이트 관련 함수들 ---
function switchToStatusScreen() {
    document.getElementById('register-section').classList.add('hidden');
    document.getElementById('status-section').classList.remove('hidden');
    document.getElementById('my-platform').innerText = myTicketInfo.platform;
    document.getElementById('my-order-number').innerText = myTicketInfo.orderNumber;
}

function handleFoodReady() {
    if (statusPollingTimer) clearInterval(statusPollingTimer);
    
    const statusText = document.getElementById('cooking-status');
    statusText.innerText = "✅ READY!";
    statusText.style.color = "#2e7d32";
    statusText.style.fontSize = "40px";
    
    // 다국어 처리된 상태 메시지
    document.getElementById('status-message').innerHTML = userLang === 'ko' 
        ? "음식이 준비되었습니다.<br>카운터로 오셔서 픽업해주세요!" 
        : "Your order is ready.<br>Please come to the counter!";
    document.getElementById('status-message').style.color = "#2e7d32";
    document.getElementById('status-message').style.fontSize = "18px";
    
    document.querySelector('.status-card').style.backgroundColor = "#e8f5e9";
}

function showLoading(isShow) {
    if (isShow) document.getElementById('loading').classList.remove('hidden');
    else document.getElementById('loading').classList.add('hidden');
}

document.getElementById('btn-register').addEventListener('click', registerWaiting);
init();
