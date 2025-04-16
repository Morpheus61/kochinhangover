import { supabase } from './supabase-client';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';

// Helper function to safely get guest property
const safeGetGuestProperty = (guest, property, defaultValue) => {
    return guest && property in guest ? guest[property] : defaultValue;
};

// Format payment info for WhatsApp message
const formatWhatsAppPaymentInfo = (guest) => {
    if (!guest) return '';
    
    const amount = guest.amount_paid || 0;
    const balance = guest.balance_amount || 0;
    
    if (amount === 0 && balance === 0) return '';
    
    let info = '\n\nPayment Info:';
    if (amount > 0) info += `\nPaid: ₹${amount}`;
    if (balance > 0) info += `\nBalance: ₹${balance}`;
    return info;
};

// Generate guest pass image
const createGuestPass = async (guest, qrCodeDataURL) => {
    const tempDiv = document.createElement('div');
    tempDiv.className = 'guest-pass-container';
    tempDiv.style.cssText = 'width:600px;height:800px;position:absolute;left:-9999px;';
    tempDiv.innerHTML = `<!-- Your guest pass HTML template -->`;
    
    document.body.appendChild(tempDiv);
    const canvas = await html2canvas(tempDiv);
    const imageDataURL = canvas.toDataURL('image/png');
    document.body.removeChild(tempDiv);
    
    return {
        imageUrl: imageDataURL,
        fileName: `kochin-hangover-pass-${guest.guest_name.replace(/\s+/g, '-').toLowerCase()}.png`
    };
};

// Create and show WhatsApp share modal
const showWhatsAppModal = (isMobile) => {
    const modal = document.createElement('div');
    modal.className = 'whatsapp-share-modal fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-75';
    
    modal.innerHTML = isMobile ? `
        <div class="kochin-container p-6 max-w-md mx-auto">
            <h3 class="text-xl font-bold mb-4 kochin-header">Share Guest Pass</h3>
            <p class="mb-4">Ready to share via WhatsApp?</p>
            <div class="flex justify-between">
                <button id="shareNowBtn" class="kochin-button flex-1 bg-green-600">
                    <i class="fab fa-whatsapp mr-2"></i> Share Now
                </button>
                <button id="cancelShareBtn" class="kochin-button bg-gray-600 flex-1">
                    Cancel
                </button>
            </div>
        </div>
    ` : `
        <div class="kochin-container p-6 max-w-md mx-auto">
            <h3 class="text-xl font-bold mb-4 kochin-header">Share Guest Pass</h3>
            <p class="mb-4">For WhatsApp Desktop:</p>
            <ol class="list-decimal pl-6 mb-6">
                <li class="mb-2">Click "Open WhatsApp" below</li>
                <li class="mb-2">Copy the message text</li>
                <li class="mb-2">Paste into WhatsApp chat</li>
                <li class="mb-2">Attach the downloaded pass</li>
            </ol>
            <div class="flex justify-between">
                <button id="shareNowBtn" class="kochin-button flex-1 bg-green-600">
                    <i class="fab fa-whatsapp mr-2"></i> Open WhatsApp
                </button>
                <button id="cancelShareBtn" class="kochin-button bg-gray-600 flex-1">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    return modal;
};

// Initialize WhatsApp share functionality
export const initWhatsAppShare = () => {
    document.addEventListener('click', async function(e) {
        if (e.target.closest('.whatsapp-share')) {
            const button = e.target.closest('.whatsapp-share');
            const guestId = button.getAttribute('data-guest-id');
            
            try {
                // Get guest data
                const { data: guest, error } = await supabase
                    .from('guests')
                    .select('*')
                    .eq('id', guestId)
                    .single();
                
                if (error) throw error;
                
                // Format mobile number for WhatsApp
                let mobileNumber = guest.mobile_number.replace(/[\s\-()]/g, '');
                if (!mobileNumber.startsWith('+')) {
                    mobileNumber = mobileNumber.startsWith('0') 
                        ? '+91' + mobileNumber.substring(1) 
                        : '+91' + mobileNumber;
                }
                
                // Generate QR code
                const qrData = JSON.stringify({
                    id: guest.id,
                    name: guest.guest_name,
                    timestamp: new Date().toISOString()
                });
                
                const qrCodeDataURL = await QRCode.toDataURL(qrData, {
                    width: 300,
                    margin: 2,
                    color: { dark: '#2a0e3a', light: '#ffffff' }
                });

                // Create guest pass image
                const { imageUrl: guestPassImageUrl, fileName: guestPassFileName } = await createGuestPass(guest, qrCodeDataURL);
                
                // Create WhatsApp message
                const message = `KOCHIN HANGOVER - GUEST PASS\n\nName: ${guest.guest_name}\nClub: ${guest.club_name || ''}\nMobile: ${guest.mobile_number}\nEntry Type: ${guest.entry_type === 'stag' ? 'STAG' : 'COUPLE'}${safeGetGuestProperty(guest, 'has_room_booking', false) ? ' + ROOM' : ''}${formatWhatsAppPaymentInfo(guest)}\n\nPlease show this pass at the entrance.`;

                // Remove existing modals
                document.querySelectorAll('.whatsapp-share-modal').forEach(m => m.remove());

                // Show modal and handle sharing
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                const modal = showWhatsAppModal(isMobile);
                
                let downloadTriggered = false;
                const triggerDownload = () => {
                    if (!downloadTriggered) {
                        const downloadLink = document.createElement('a');
                        downloadLink.href = guestPassImageUrl;
                        downloadLink.download = guestPassFileName;
                        document.body.appendChild(downloadLink);
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                        downloadTriggered = true;
                    }
                };

                // Share handler
                document.getElementById('shareNowBtn').addEventListener('click', () => {
                    triggerDownload();
                    
                    const whatsappNumber = mobileNumber.replace('+', '');
                    const messageEncoded = encodeURIComponent(message);
                    
                    if (isMobile) {
                        // Mobile handling with native app only
                        const whatsappUrl = `whatsapp://send?phone=${whatsappNumber}&text=${messageEncoded}`;
                        
                        if (/Android/i.test(navigator.userAgent)) {
                            // For Android, use iframe approach
                            const iframe = document.createElement('iframe');
                            iframe.style.display = 'none';
                            iframe.src = whatsappUrl;
                            document.body.appendChild(iframe);
                            setTimeout(() => document.body.removeChild(iframe), 100);
                        } else {
                            // For iOS, use direct href
                            window.location.href = whatsappUrl;
                        }
                    } else {
                        // Desktop handling - open WhatsApp Web directly
                        window.open(`https://web.whatsapp.com/send?phone=${whatsappNumber}&text=${messageEncoded}`, '_blank');
                    }
                    
                    modal.remove();
                });

                // Cancel handler
                document.getElementById('cancelShareBtn').addEventListener('click', () => {
                    modal.remove();
                });

            } catch (error) {
                console.error('Error sharing guest pass:', error);
                alert('Failed to share guest pass. Please try again.');
            }
        }
    });
}; 