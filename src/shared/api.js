// --- 구글 시트(GAS) 전용 통신 헬퍼 ---

const EasyQApi = {
    /**
     * GAS로 데이터를 보내거나 가져옵니다.
     * @param {string} gasAppId - 매장 고유 ID (GAS Web App URL)
     * @param {object} params - 보낼 데이터 (예: {action: 'register', name: '김철수'})
     * @returns {Promise<object>} - JSON 응답 결과
     */
    async request(gasAppId, params) {
        // 객체 데이터를 URL 파라미터 문자열로 변환 (예: action=register&name=김철수)
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = `${gasAppId}?${queryString}`;

        try {
            // GET 방식으로 요청 (구글 Apps Script는 GET이 CORS 우회에 가장 안정적임)
            const response = await fetch(fullUrl, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
            
        } catch (error) {
            console.error("EasyQ API 통신 오류:", error);
            // 프론트엔드에서 일관되게 에러를 처리할 수 있도록 규격화하여 반환
            return { status: 'error', message: '서버와 통신할 수 없습니다.' };
        }
    }
};

// 전역에서 사용할 수 있게 설정 (브라우저 환경)
window.EasyQApi = EasyQApi;
