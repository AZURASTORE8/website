console.log('Rewards page loaded');

document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM fully loaded');
    
    // Check if user is logged in
    const userData = localStorage.getItem('discordUser');
    console.log('User data from localStorage:', userData);
    
    if (!userData) {
        console.log('No user data found, redirecting to login');
        window.location.href = 'login.html';
        return;
    }
    
    let user;
    try {
        user = JSON.parse(userData);
        console.log('Parsed user data:', user);
    } catch (e) {
        console.error('Error parsing user data:', e);
        window.location.href = 'login.html';
        return;
    }
    
    if (!user || !user.id) {
        console.log('Invalid user data, redirecting to login');
        window.location.href = 'login.html';
        return;
    }
    
    console.log('User authenticated, loading rewards...');

    try {
        // Load available rewards
        console.log('Calling loadRewards()...');
        await loadRewards();
        console.log('loadRewards() completed successfully');
    } catch (error) {
        console.error('Error in loadRewards:', error);
        const container = document.getElementById('rewardsContainer');
        if (container) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger">
                        <h4>เกิดข้อผิดพลาดในการโหลดข้อมูลรางวัล</h4>
                        <p>กรุณารีเฟรชหน้าหรือลองใหม่อีกครั้งในภายหลัง</p>
                        <p><small>${error.message || 'Unknown error'}</small></p>
                    </div>
                </div>`;
        }
    }

    // Handle redeem button clicks using event delegation
    document.getElementById('rewardsContainer').addEventListener('click', async (e) => {
        const redeemBtn = e.target.closest('.redeem-btn');
        if (!redeemBtn) return;
        
        const rewardId = redeemBtn.dataset.rewardId;
        if (!rewardId) return;
        
        if (redeemBtn.disabled) return;
        
        // Show loading state
        const originalText = redeemBtn.innerHTML;
        redeemBtn.disabled = true;
        redeemBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> กำลังดำเนินการ...';
        
        try {
            const response = await fetch('/api/redeem-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    rewardId: rewardId,
                    userId: user.id
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                // Add to claimed rewards
                const claimedRewards = JSON.parse(localStorage.getItem('claimedRewards') || '{}');
                claimedRewards[rewardId] = data.code;
                localStorage.setItem('claimedRewards', JSON.stringify(claimedRewards));
                
                // Add to transaction history
                const reward = rewardsList.find(r => r.id === rewardId);
                if (reward) {
                    const transaction = {
                        id: Date.now(),
                        type: 'reward',
                        item: reward.name,
                        code: data.code,
                        date: new Date().toISOString()
                    };
                    
                    const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
                    transactions.unshift(transaction);
                    localStorage.setItem('transactions', JSON.stringify(transactions));
                }
                
                // Show success message
                showSuccessPopup(`คุณได้รับโค้ด: ${data.code} เรียบร้อยแล้ว!`);
                
                // Reload rewards to update UI
                await loadRewards();
            } else {
                alert(data.message || 'เกิดข้อผิดพลาดในการรับโค้ด');
                // Reload rewards to update UI
                await loadRewards();
            }
        } catch (error) {
            console.error('Error:', error);
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
            // Reset button state
            redeemBtn.disabled = false;
            redeemBtn.innerHTML = originalText;
        }
    });
});

// Global variable to store rewards list
let rewardsList = [];

// Function to create reward card HTML
function createRewardCard(reward, isClaimed, remaining) {
    const isAvailable = remaining > 0 && !isClaimed;
    let buttonHtml = '';
    
    if (isClaimed) {
        buttonHtml = `
            <button class="reward-button btn-claimed" disabled>
                <i class="fas fa-check-circle"></i> รับแล้ว
            </button>`;
    } else if (remaining <= 0) {
        buttonHtml = `
            <button class="reward-button btn-out-of-stock" disabled>
                <i class="fas fa-times-circle"></i> ของหมดแล้ว
            </button>`;
    } else {
        buttonHtml = `
            <button class="reward-button btn-claim" data-reward-id="${reward.id}">
                <i class="fas fa-gift"></i> รับรางวัล
            </button>`;
    }
    
    return `
    <div class="reward-card">
        <img src="${reward.image || './assets/logo.png'}" alt="${reward.name}" class="reward-image">
        <div class="reward-content">
            <h3 class="reward-title">${reward.name}</h3>
            <p class="reward-description">${reward.description || 'รับรางวัลพิเศษสำหรับคุณ'}</p>
            <div class="reward-stats">
                <span>จำนวนคงเหลือ</span>
                <span class="reward-remaining">${remaining} ชิ้น</span>
            </div>
            ${buttonHtml}
        </div>
    </div>`;
}

async function loadRewards() {
    console.log('Loading rewards...');
    const container = document.getElementById('rewardsContainer');
    
    if (!container) {
        console.error('Rewards container not found');
        return;
    }
    
    try {
        // Show loading state
        container.innerHTML = '<div class="col-12 text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">กำลังโหลดรายการของรางวัล...</p></div>';
        
        console.log('Fetching rewards from /api/rewards');
        const response = await fetch('/api/rewards');
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to load rewards:', response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        rewardsList = await response.json();
        console.log('Received rewards data:', rewardsList);
        
        if (!Array.isArray(rewardsList)) {
            console.error('Invalid rewards data format:', rewardsList);
            throw new Error('Invalid rewards data format');
        }
        
        // Get user's claimed rewards
        let claimedRewards = {};
        try {
            claimedRewards = JSON.parse(localStorage.getItem('claimedRewards') || '{}');
            console.log('Claimed rewards from localStorage:', claimedRewards);
        } catch (e) {
            console.error('Error parsing claimedRewards from localStorage:', e);
            claimedRewards = {};
        }
        
        // Clear container
        container.innerHTML = '';
        
        // Clear loading spinner
        container.innerHTML = '';
        
        // Render each reward
        rewardsList.forEach(reward => {
            try {
                const isClaimed = claimedRewards[reward.id];
                const remaining = Math.max(0, reward.maxClaims - (reward.claimedCount || 0));
                
                // Create and append reward card
                const rewardElement = document.createElement('div');
                rewardElement.innerHTML = createRewardCard(reward, isClaimed, remaining);
                container.appendChild(rewardElement);
                
                console.log(`Rendered reward: ${reward.id}`, { isClaimed, remaining });
            } catch (error) {
                console.error(`Error rendering reward ${reward.id}:`, error);
            }
        });
        
    } catch (error) {
        console.error('Error loading rewards:', error);
        const container = document.getElementById('rewardsContainer');
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center text-danger">
                    <p>เกิดข้อผิดพลาดในการโหลดรายการของรางวัล</p>
                    <button class="btn btn-sm btn-outline-secondary" onclick="location.reload()">ลองอีกครั้ง</button>
                </div>`;
        }
    }
}

function showSuccessPopup(message) {
    // Create popup if it doesn't exist
    let popup = document.getElementById('successPopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'successPopup';
        popup.className = 'success-popup';
        popup.innerHTML = `
            <div class="popup-content">
                <div class="popup-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="popup-message">${message}</div>
                <button class="btn btn-sm btn-primary mt-3" onclick="this.closest('.success-popup').remove()">ตกลง</button>
            </div>
        `;
        document.body.appendChild(popup);
    }
    
    // Show popup
    popup.style.display = 'flex';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        popup.style.display = 'none';
    }, 5000);
}
