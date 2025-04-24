// This function fixes the QR scanner error handling
function initQRScanner() {
    // First, ensure any existing scanner is properly stopped and cleared
    if (qrScanner) {
        try {
            qrScanner.clear();
            qrScanner = null;
            
            // Additional cleanup for any leftover video elements
            const videoElements = document.querySelectorAll('#qr-reader video, #qr-reader canvas');
            videoElements.forEach(video => {
                if (video.srcObject) {
                    const tracks = video.srcObject.getTracks();
                    tracks.forEach(track => track.stop());
                    video.srcObject = null;
                }
                video.remove();
            });
            
            // Remove any existing scanner elements completely
            const qrReaderElement = document.getElementById('qr-reader');
            if (qrReaderElement) {
                qrReaderElement.remove();
            }
        } catch (e) {
            console.error('Error cleaning up previous scanner:', e);
        }
    }

    // Get the QR scanner container element
    const qrScannerContainer = document.getElementById('qrScanner');
    
    // If the container doesn't exist, return early
    if (!qrScannerContainer) {
        console.error('QR Scanner container not found');
        return;
    }
    
    // Clear any existing content
    qrScannerContainer.innerHTML = '<div id="qr-reader"></div>';

    // Create new scanner with a slight delay to ensure DOM is ready
    setTimeout(() => {
        qrScanner = new Html5QrcodeScanner(
            "qr-reader", 
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                showTorchButtonIfSupported: true,
                showZoomSliderIfSupported: true,
                defaultZoomValueIfSupported: 2
            }
        );
        
        qrScanner.render(async (decodedText) => {
            try {
                // Parse the QR code data
                let guestData;
                
                try {
                    // First try to parse the QR code as JSON
                    guestData = JSON.parse(decodedText);
                } catch (parseError) {
                    console.error('Failed to parse QR code data:', parseError);
                    throw new Error('Invalid QR code format');
                }
                
                // Validate the parsed data
                if (!guestData) {
                    throw new Error('Empty QR code data');
                }
                
                if (!guestData.id) {
                    throw new Error('Missing guest ID in QR code');
                }
                
                // Get the latest guest data from Supabase
                const { data: guest, error } = await supabase
                    .from('guests')
                    .select('*')
                    .eq('id', guestData.id)
                    .single();
                
                if (error) {
                    console.error('Supabase error:', error);
                    throw new Error('Database error: ' + (error.message || 'Unknown error'));
                }
                
                if (!guest) {
                    throw new Error('Guest not found in database');
                }
                
                // Calculate expected amount and payment status
                const expectedAmount = guest.entry_type === 'stag' ? 2750 : 4750;
                const isFullyPaid = guest.paid_amount >= expectedAmount;
                
                // Show verification result modal
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4';
                modal.innerHTML = `
                    <div class="bg-[#2a0e3a] p-6 rounded-lg max-w-md w-full">
                        <div class="text-center mb-6">
                            <i class="fas ${isFullyPaid ? 'fa-check-circle text-green-400' : 'fa-exclamation-triangle text-yellow-400'} text-5xl"></i>
                            <h3 class="text-2xl font-bold mt-4 ${isFullyPaid ? 'text-green-400' : 'text-yellow-400'}">
                                ${isFullyPaid ? 'VERIFIED' : 'PAYMENT PENDING'}
                            </h3>
                        </div>
                        
                        <div class="space-y-4 mb-6">
                            <div class="flex justify-between">
                                <span class="text-gray-300">Full Name</span>
                                <span class="font-bold">${guest.guest_name}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-300">Club Name</span>
                                <span class="font-bold">${guest.club_name || 'N/A'}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-300">Entry Type</span>
                                <span class="font-bold">${guest.entry_type.toUpperCase()}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-300">Payment Status</span>
                                <span class="font-bold ${isFullyPaid ? 'text-green-400' : 'text-yellow-400'}">
                                    ${isFullyPaid ? 'PAID IN FULL' : 'PARTIAL PAYMENT'}
                                </span>
                            </div>
                            ${!isFullyPaid ? `
                            <div class="flex justify-between">
                                <span class="text-gray-300">Amount Due</span>
                                <span class="font-bold text-red-400">₹${expectedAmount - guest.paid_amount}</span>
                            </div>
                            ` : ''}
                        </div>
                        
                        <div class="flex space-x-4">
                            ${isFullyPaid ? 
                                `<button onclick="verifyGuest('${guest.id}')" class="kochin-button flex-1 bg-green-600">
                                    <i class="fas fa-check mr-2"></i> Allow Entry
                                </button>` : 
                                `<button class="kochin-button bg-yellow-600 flex-1 cursor-not-allowed" disabled>
                                    <i class="fas fa-ban mr-2"></i> Entry Denied
                                </button>`
                            }
                            <button onclick="this.closest('.fixed').remove(); qrScanner.resume();" class="kochin-button bg-gray-700 flex-1">
                                Close
                            </button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
                qrScanner.pause();
                
            } catch (error) {
                console.error('QR code processing error:', error);
                // Ensure we always have a valid error message string
                const errorMessage = error && typeof error.message === 'string' ? error.message : 'Unknown error';
                alert('Error processing QR code: ' + errorMessage);
                qrScanner.resume();
            }
        }, (errorMessage) => {
            // This is the error callback from the scanner itself
            console.log('QR Scanner error:', errorMessage);
            // We don't need to alert here as this is just for scanning errors, not processing errors
        });
    }, 300);
}
