const btn = document.getElementById('btnReceiveRole');
const discordId = localStorage.getItem('discordId'); // ต้องเก็บ Discord ID หลัง OAuth2

btn.addEventListener('click', async () => {
  if (!discordId) {
    alert("กรุณาเข้าสู่ระบบ Discord ก่อน");
    return;
  }

  try {
    const res = await fetch('/give-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordId })
    });

    const data = await res.json();
    if (data.success) {
      alert("✅ รับยศเรียบร้อยแล้ว!");
      btn.disabled = true;
      btn.textContent = "รับแล้ว";
    } else {
      alert("❌ เกิดข้อผิดพลาด: " + data.message);
    }
  } catch (err) {
    console.error(err);
    alert("❌ เกิดข้อผิดพลาด ติดต่อแอดมิน");
  }
});
