// ... (초기 세팅과 API 주소 가져오는 부분은 app.js와 동일) ...

async function registerWaiting() {
    const platform = document.getElementById('platform').value;
    const orderNumber = document.getElementById('order-number').value.trim();

    if (!orderNumber) { alert("Please enter the order number."); return; }

    showLoading(true);

    try {
        // GAS API에 기사 등록 요청 (action=registerRider 로 일반 손님과 구분)
        const response = await fetch(`${gasAppId}?action=registerRider&platform=${platform}&orderNumber=${orderNumber}`);
        const data = await response.json();

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
        alert("Network error. Please try again.");
    } finally {
        showLoading(false);
    }
}

// 상태 체크 함수
function checkMyTurn() {
    if (!myTicketInfo) return;

    fetch(`${gasAppId}?action=getRiderStatus&ticketId=${myTicketInfo.ticketId}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // 사장님이 '호출(Ready)' 버튼을 눌렀을 때
                if (data.ticketStatus === '픽업 요망') {
                    handleFoodReady();
                }
            }
        });
}

function handleFoodReady() {
    clearInterval(statusPollingTimer);
    localStorage.removeItem(STORAGE_KEY);
    
    // 화면을 강렬하게 바꾸고 소리를 울리게 유도 (기사님 입장 신호)
    const statusText = document.getElementById('cooking-status');
    statusText.innerText = "✅ READY!";
    statusText.style.color = "#2e7d32";
    statusText.style.fontSize = "40px";
    
    document.getElementById('status-message').innerText = "음식이 준비되었습니다. 카운터로 와주세요!\nYour order is ready. Please come to the counter.";
    document.getElementById('status-message').style.color = "#2e7d32";
    document.getElementById('status-message').style.fontSize = "18px";
    
    // 배경색을 초록색 계열로 살짝 바꿔 시각적 효과 극대화
    document.querySelector('.status-card').style.backgroundColor = "#e8f5e9";
}
