// --- Pusher 실시간 통신 초기화 모듈 ---

const EasyQPusher = {
    // 💡 향후 Pusher 가입 후 발급받는 실제 Key로 변경하세요!
    APP_KEY: 'YOUR_PUSHER_APP_KEY',
    CLUSTER: 'YOUR_PUSHER_CLUSTER',

    /**
     * 특정 매장의 채널을 구독하고 실시간 신호를 대기합니다.
     * @param {string} gasAppId - 매장 고유 ID (이 값을 바탕으로 방을 만듦)
     * @param {function} onNewTicketCallback - 신호가 왔을 때 실행할 함수
     */
    init(gasAppId, onNewTicketCallback) {
        // Pusher 객체가 로드되지 않았으면 에러 처리
        if (typeof Pusher === 'undefined') {
            console.error("Pusher 라이브러리가 로드되지 않았습니다.");
            return;
        }

        // Pusher 연결
        const pusher = new Pusher(this.APP_KEY, {
            cluster: this.CLUSTER,
            forceTLS: true // 보안 연결 강제
        });

        // 매장 고유 ID를 안전한 문자열로 변환하여 채널 이름 생성
        // 예: https://script.google.com/... -> 특수문자 제거 후 사용
        const safeChannelName = 'shop_' + gasAppId.replace(/[^a-zA-Z0-9]/g, '');
        
        const channel = pusher.subscribe(safeChannelName);

        // 'new-ticket' 이라는 이벤트 이름으로 신호가 오면 콜백 함수 실행
        channel.bind('new-ticket', function(data) {
            console.log(`[Pusher] ${safeChannelName} 방에서 신호 감지됨:`, data);
            
            if (typeof onNewTicketCallback === 'function') {
                onNewTicketCallback(data);
            }
        });

        return pusher;
    }
};

window.EasyQPusher = EasyQPusher;
