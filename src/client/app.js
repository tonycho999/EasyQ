// --- EasyQ Client Logic ---

// 1. URL 파라미터에서 식당 고유 GAS API URL 가져오기
// 스캔할 QR코드 주소 예시: waiting.com/client?id=ENCODED_GAS_WEB_APP_URL
const urlParams = new URLSearchParams(window.location.search);
const gasAppId = urlParams.get('id'); // 이것이 이 식당의 독립된 DB 주소역할을 함

if (!gasAppId) {
    alert("오류: 올바르지 않은 QR코드입니다. 매장에 문의해주세요.");
    document.body.innerHTML = "<h1>접근 오류</h1>";
}

// 2. DOM 요소 가져오기
const el = {
    shopName: document.getElementById('shop-name'),
    registerSection: document.getElementById('register-section'),
    statusSection: document.getElementById('status-section'),
    userName: document.getElementById('user-name'),
    userCount: document.getElementById('user-count'),
    btnRegister: document.getElementById('btn-register'),
    myTurn: document.getElementById('my-turn'),
    myTicketNumber: document.getElementById('my-ticket-number'),
    myCount: document.getElementById('my-count'),
    loading: document.getElementById('loading')
};

// 로컬 스토리지 키 값 정의 (여러 식당을 이용해도 섞이지 않게 id를 붙임)
const STORAGE_KEY = `easyq_ticket_${gasAppId}`;

// 전역 변수 (내 티켓 정보 보관)
let myTicketInfo = null;
let statusPollingTimer = null; // 자동 새로고침 타이머

// --- 초기화 함수 ---
async function init() {
    // A. 매장명 등 기본 정보 가져오기 (초기 로딩 시 1회)
    fetchShopInfo();

    // B. 이미 등록된 티켓이 로컬 스토리지에 있는지 확인
    const savedTicket = localStorage.getItem(STORAGE_KEY);
    if (savedTicket) {
        myTicketInfo = JSON.parse(savedTicket);
        // 이미 등록된 상태라면 바로 상태 화면으로 점프
        switchToStatusScreen();
        startStatusPolling(); // 실시간 업데이트 시작
    }
}

// --- 매장 정보 가져오기 ---
function fetchShopInfo() {
    // GAS API에 매장 정보 요청 (GET)
    fetch(`${gasAppId}?action=getShopInfo`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                el.shopName.innerText = data.shopName;
            }
        })
        .catch(err => console.error("매장 정보 로딩 실패:", err));
}

// --- 대기 등록 실행 ---
async function registerWaiting() {
    const name = el.userName.value.trim();
    const count = parseInt(el.userCount.value);

    // 유효성 검사
    if (!name) { alert("이름을 입력해주세요."); el.userName.focus(); return; }
    if (!count || count < 1) { alert("인원수를 올바르게 입력해주세요."); el.userCount.focus(); return; }

    showLoading(true);

    try {
        // GAS API에 등록 요청 (POST - JSONP 방식으로 CORS 우회)
        // GAS doPost는 CORS 처리가 까다로워 JSONP나 GET 방식 parameter로 넘기는 꼼수를 많이 씀
        // 여기서는 가장 구현이 쉬운 GET 방식으로 데이터 전송 예시 (배포 시 POST 권장)
        const response = await fetch(`${gasAppId}?action=register&name=${encodeURIComponent(name)}&count=${count}`);
        const data = await response.json();

        if (data.status === 'success') {
            // 등록 성공
            myTicketInfo = {
                ticketId: data.ticketId, // 구글 시트에 저장된 고유 ID
                ticketNumber: data.ticketNumber, // 손님이 보는 번호
                name: name,
                count: count
            };
            
            // 로컬 스토리지에 저장 (화면 꺼짐 대비)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(myTicketInfo));
            
            // 화면 스위칭 및 상태 폴링 시작
            switchToStatusScreen();
            startStatusPolling();
        } else {
            alert(`등록 실패: ${data.message}`);
        }
    } catch (error) {
        console.error("등록 중 오류 발생:", error);
        alert("서버 통신 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
        showLoading(false);
    }
}

// --- 내 순서 실시간 확인 (Polling) ---
function checkMyTurn() {
    if (!myTicketInfo) return;

    // GAS API에 내 순서 확인 요청 (GET)
    fetch(`${gasAppId}?action=getMyStatus&ticketId=${myTicketInfo.ticketId}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                el.myTurn.innerText = data.currentTurn; // 대기 순서 (예: 3번째)
                
                // 만약 입장 완료 상태라면?
                if (data.ticketStatus === '입장 완료') {
                    handleAdmission();
                }
            }
        })
        .catch(err => console.error("순서 업데이트 실패:", err));
}

// --- 자동 새로고침 시작 (15초 주기) ---
function startStatusPolling() {
    // 이미 타이머가 있다면 클리어
    if (statusPollingTimer) clearInterval(statusPollingTimer);
    
    // 즉시 한 번 확인 후
    checkMyTurn();
    
    // 15초마다 반복 (구글 시트 과부하 방지 최소값)
    statusPollingTimer = setInterval(checkMyTurn, 15000);
}

// --- 화면 관련 유틸 함수 ---
function switchToStatusScreen() {
    el.registerSection.classList.add('hidden');
    el.statusSection.classList.remove('hidden');
    
    // 내 티켓 정보 박기
    el.myTicketNumber.innerText = myTicketInfo.ticketNumber;
    el.myCount.innerText = myTicketInfo.count;
}

function handleAdmission() {
    // 폴링 중지
    clearInterval(statusPollingTimer);
    
    // 로컬 스토리지 삭제
    localStorage.removeItem(STORAGE_KEY);
    
    // 안내 문구 변경
    document.querySelector('.status-card h2').innerText = "입장하세요!";
    el.myTurn.innerHTML = `<span style="font-size:30px;color:#2e7d32;">맛있게 드세요!</span>`;
    document.getElementById('status-message').innerText = "입장 차례가 되었습니다. 점원에게 화면을 보여주세요.";
    document.getElementById('status-message').style.color = "#2e7d32";
}

function showLoading(isShow) {
    if (isShow) el.loading.classList.remove('hidden');
    else el.loading.classList.add('hidden');
}

// --- 이벤트 리스너 등록 ---
el.btnRegister.addEventListener('click', registerWaiting);

// 모바일 엔터키 등록 지원
el.userCount.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') registerWaiting();
});

// 시작
init();
