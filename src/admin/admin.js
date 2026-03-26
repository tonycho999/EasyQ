// --- 1. 매장 API 주소 가져오기 ---
const urlParams = new URLSearchParams(window.location.search);
const gasAppId = urlParams.get('id');

if (!gasAppId) {
    alert("올바르지 않은 관리자 링크입니다.");
}

// --- 2. DOM 요소 ---
const el = {
    tabWalkin: document.getElementById('tab-walkin'),
    tabRider: document.getElementById('tab-rider'),
    listWalkin: document.getElementById('list-walkin'),
    listRider: document.getElementById('list-rider'),
    btnRefresh: document.getElementById('btn-refresh'),
    loading: document.getElementById('loading'),
    alertSound: document.getElementById('alert-sound')
};

// --- 3. Pusher 실시간 알림 세팅 (Shared 모듈 사용) ---
// pusher-setup.js에 만들어둔 함수를 호출만 하면 끝!
EasyQPusher.init(gasAppId, (data) => {
    console.log("새로운 접수 알림 도착!");
    
    // 1. 소리 울리기 (브라우저 정책상 사용자 상호작용이 한 번은 있어야 소리가 남)
    el.alertSound.play().catch(e => console.log("자동 재생 방지됨. 화면을 한 번 터치하세요."));
    
    // 2. 화면 데이터 새로고침
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

// --- 5. 구글 시트에서 리스트 가져오기 (Shared 모듈 사용) ---
async function fetchList() {
    el.loading.classList.remove('hidden');
    
    try {
        // api.js에 만들어둔 공통 함수 사용 (코드가 훨씬 간결해짐)
        const data = await EasyQApi.request(gasAppId, { action: 'getAdminList' });
        
        if (data.status === 'success') {
            renderWalkinList(data.walkinList);
            renderRiderList(data.riderList);
        }
    } catch (error) {
        console.error("데이터 불러오기 실패:", error);
    } finally {
        el.loading.classList.add('hidden');
    }
}

// --- 6. 화면에 카드 그리기 ---
function renderWalkinList(list) {
    if (list.length === 0) {
        el.listWalkin.innerHTML = '<div class="empty-msg">현재 대기 중인 손님이 없습니다.</div>';
        return;
    }
    
    let html = '';
    list.forEach((item, index) => {
        html += `
            <div class="ticket-card">
                <div class="card-info">
                    <span class="turn-badge">대기 ${index + 1}번</span>
                    <span class="ticket-detail">총 ${item.count}명 / ${item.time}</span>
                </div>
                <div class="ticket-name">🙋‍♂️ ${item.name}</div>
                <div class="card-actions">
                    <button class="btn btn-call" onclick="updateStatus('${item.id}', '호출')">🔔 호출</button>
                    <button class="btn btn-admit" onclick="updateStatus('${item.id}', '입장 완료')">✅ 입장 완료</button>
                    <button class="btn btn-cancel" onclick="updateStatus('${item.id}', '취소')">취소</button>
                </div>
            </div>
        `;
    });
    el.listWalkin.innerHTML = html;
}

function renderRiderList(list) {
    if (list.length === 0) {
        el.listRider.innerHTML = '<div class="empty-msg">현재 대기 중인 기사님이 없습니다.</div>';
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
                <div class="ticket-name">🛵 주문번호: ${item.orderNumber}</div>
                <div class="card-actions">
                    <button class="btn btn-call" style="background-color: #2e7d32;" onclick="updateStatus('${item.id}', '픽업 요망')">✅ 조리 완료 (호출)</button>
                    <button class="btn btn-cancel" onclick="updateStatus('${item.id}', '픽업 완료')">전달 완료</button>
                </div>
            </div>
        `;
    });
    el.listRider.innerHTML = html;
}

// --- 7. 상태 업데이트 (Shared 모듈 사용) ---
async function updateStatus(ticketId, newStatus) {
    el.loading.classList.remove('hidden');
    
    try {
        // api.js 함수를 사용하여 깔끔하게 데이터 전송
        await EasyQApi.request(gasAppId, { 
            action: 'updateStatus', 
            ticketId: ticketId, 
            status: newStatus 
        });
        
        // 처리 후 리스트 다시 불러오기
        fetchList();
    } catch (error) {
        alert("상태 변경에 실패했습니다. 다시 시도해주세요.");
    }
}

// 수동 새로고침 버튼 이벤트
el.btnRefresh.addEventListener('click', fetchList);

// 앱 시작 시 데이터 1회 로드
fetchList();
