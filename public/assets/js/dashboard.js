$(document).ready(function () {
            // Auto-dismiss success alerts after 5 seconds
            setTimeout(function() {
                $('.alert-success').fadeOut(500, function() { $(this).remove(); });
            }, 5000);

            // Initialize User Appointments Ledger DataTable if table exists
            const tableElem = document.getElementById('sortableTable');
            let userTable = null;
            if (tableElem) {
                const tableEmptyFilterHtml = `
                    <div class="empty-registry-state in-table">
                        <div class="empty-registry-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>
                                <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
                            </svg>
                        </div>
                        <h3 class="empty-registry-title">No matching reservations</h3>
                        <p class="empty-registry-desc">No requests match the selected status filter or search query.</p>
                        <button type="button" class="table-empty-reset-btn">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                                <path d="M3 3v5h5"></path>
                            </svg>
                            <span>Reset filters</span>
                        </button>
                    </div>
                `;

                userTable = new DataTable('#sortableTable', {
                    order: [[0, 'desc']], // Most upcoming/recent schedule first
                    pageLength: 8,
                    lengthChange: false,
                    layout: {
                        topStart: null,
                        topEnd: null
                    },
                    language: {
                        search: "",
                        searchPlaceholder: "Search reservations...",
                        zeroRecords: tableEmptyFilterHtml
                    },
                    columnDefs: [
                        { targets: '_all', orderSequence: ['asc', 'desc'] },
                        { targets: 0, orderSequence: ['desc', 'asc'] },
                        { targets: [2, 4], orderable: false } // Document & Actions non-sortable
                    ]
                });

                // Interactive Search Input Hook
                $('#dashboardSearchInput').on('input', function () {
                    userTable.search(this.value).draw();
                });

                // Interactive Segmented Filter Tabs
                $('.tab-pill').on('click', function () {
                    $('.tab-pill').removeClass('active');
                    $(this).addClass('active');

                    let status = $(this).data('status');
                    // Column index 3 is Status
                    if (status) {
                        userTable.column(3).search('^' + status + '$', true, false).draw();
                    } else {
                        userTable.column(3).search('').draw();
                    }
                });

                // Delegated click handler to reset table filters and search
                $(document).on('click', '.table-empty-reset-btn', function (e) {
                    e.preventDefault();
                    $('#dashboardSearchInput').val('');
                    if (userTable) {
                        userTable.search('');
                    }
                    $('.filter-segmented-bar .tab-pill[data-status=""]').trigger('click');
                });
            }

            // Interactive File Input feedback with delete/clear capability
            const fileInput = document.getElementById('fileInput');
            const fileBoxDefaultContent = document.getElementById('fileBoxDefaultContent');
            const fileSelectedChip = document.getElementById('fileSelectedChip');
            const fileNameDisplay = document.getElementById('fileNameDisplay');
            const fileSizeDisplay = document.getElementById('fileSizeDisplay');
            const removeFileBtn = document.getElementById('removeFileBtn');

            const fileErrorMsg = $('#fileErrorMsg');

            function formatFileSize(bytes) {
                if (bytes < 1024) return bytes + ' B';
                if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
                return (bytes / 1048576).toFixed(1) + ' MB';
            }

            function clearSelectedFile() {
                if (fileInput) fileInput.value = '';
                if (fileNameDisplay) fileNameDisplay.textContent = '';
                if (fileSizeDisplay) fileSizeDisplay.textContent = '';
                if (fileSelectedChip) fileSelectedChip.style.display = 'none';
                if (fileBoxDefaultContent) fileBoxDefaultContent.style.display = 'block';
            }

            if (fileInput) {
                fileInput.addEventListener('change', function () {
                    if (this.files && this.files.length > 0) {
                        const file = this.files[0];
                        const maxBytes = 5 * 1024 * 1024; // 5MB limit
                        if (file.size > maxBytes) {
                            if (fileErrorMsg.length) {
                                fileErrorMsg.find('span').text('File exceeds 5MB limit (' + formatFileSize(file.size) + ' selected). Please choose a smaller photo or PDF.');
                                fileErrorMsg.show();
                            }
                            clearSelectedFile();
                            return;
                        }
                        if (fileErrorMsg.length) fileErrorMsg.hide();
                        if (fileNameDisplay) fileNameDisplay.textContent = file.name;
                        if (fileSizeDisplay) fileSizeDisplay.textContent = '(' + formatFileSize(file.size) + ')';
                        if (fileBoxDefaultContent) fileBoxDefaultContent.style.display = 'none';
                        if (fileSelectedChip) fileSelectedChip.style.display = 'flex';
                    } else {
                        clearSelectedFile();
                    }
                });
            }

            if (removeFileBtn) {
                removeFileBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    clearSelectedFile();
                });
            }

            // -------------------------------------------------------------
            // Modern Flatpickr with Bespoke Month Selector & Cal.com Slots
            // -------------------------------------------------------------
            const datePicker = flatpickr("#appt-date", {
                minDate: "today",
                dateFormat: "Y-m-d",
                altInput: true,
                altFormat: "F j, Y (D)",
                monthSelectorType: "static",
                disableMobile: true,
                static: true,
                disable: [
                    function (date) {
                        // Strictly disable Sunday (0) and Saturday (6)
                        return (date.getDay() === 0 || date.getDay() === 6);
                    }
                ],
                onReady: function (selectedDates, dateStr, instance) {
                    initCustomMonthPicker(instance);
                    updateNavigationLimits(instance);
                    
                    // Reliable toggle logic for calendar
                    if (instance.altInput) {
                        let isAlreadyOpen = false;
                        
                        const markState = () => { isAlreadyOpen = instance.isOpen; };
                        
                        instance.altInput.addEventListener('mousedown', markState);
                        instance.altInput.addEventListener('touchstart', markState, { passive: true });
                        
                        instance.altInput.addEventListener('click', function(e) {
                            if (isAlreadyOpen) {
                                instance.close();
                            }
                        });
                    }
                },
                onMonthChange: function (selectedDates, dateStr, instance) {
                    updateNavigationLimits(instance);
                },
                onYearChange: function (selectedDates, dateStr, instance) {
                    updateNavigationLimits(instance);
                },
                onOpen: function (selectedDates, dateStr, instance) {
                    updateNavigationLimits(instance);
                    
                    // Smart flip logic for static calendar (synchronous to prevent flashing)
                    const targetInput = instance.altInput || instance.input;
                    if (instance.calendarContainer && targetInput) {
                        const rect = targetInput.getBoundingClientRect();
                        const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
                        const spaceBelow = vh - rect.bottom;
                        
                        if (spaceBelow < 400) { // Using 400 to be extremely safe for mobile
                            instance.calendarContainer.classList.add('is-dropup');
                        } else {
                            instance.calendarContainer.classList.remove('is-dropup');
                        }
                    }
                },
                onClose: function (selectedDates, dateStr, instance) {
                    closeMonthMenu(instance);
                },
                onChange: function (selectedDates, dateStr) {
                    if (dateStr) {
                        fetchAndRenderSlots(dateStr, $('#appt-service').val());
                    }
                }
            });

            // Initialize custom floating month picker & enforce navigation bounds
            function initCustomMonthPicker(instance) {
                if (!instance || !instance.calendarContainer) return;

                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

                // Ensure custom month menu card is appended to calendarContainer once
                let menu = instance.calendarContainer.querySelector('.flatpickr-custom-month-menu');
                if (!menu) {
                    menu = document.createElement('div');
                    menu.className = 'flatpickr-custom-month-menu';

                    let menuHtml = '<div class="month-menu-header">Select Month</div><div class="month-grid">';
                    months.forEach((m, idx) => {
                        menuHtml += `<button type="button" class="month-grid-btn" data-month="${idx}">${m}</button>`;
                    });
                    menuHtml += '</div>';
                    menu.innerHTML = menuHtml;

                    instance.calendarContainer.appendChild(menu);
                }

                // Event delegation on calendarContainer for toggling & selecting months
                if (!instance.calendarContainer._hasMonthPickerEvents) {
                    instance.calendarContainer._hasMonthPickerEvents = true;

                    instance.calendarContainer.addEventListener('click', function (e) {
                        const monthTrigger = e.target.closest('.cur-month');
                        if (monthTrigger) {
                            e.stopPropagation();
                            const isVisible = menu.classList.contains('is-visible');
                            if (isVisible) {
                                closeMonthMenu(instance);
                            } else {
                                updateNavigationLimits(instance);
                                menu.classList.add('is-visible');
                                monthTrigger.classList.add('is-open');
                            }
                            return;
                        }

                        const monthBtn = e.target.closest('.month-grid-btn');
                        if (monthBtn && !monthBtn.disabled) {
                            e.stopPropagation();
                            const monthIdx = parseInt(monthBtn.dataset.month, 10);
                            instance.jumpToDate(new Date(instance.currentYear, monthIdx, 1), true);
                            closeMonthMenu(instance);
                            updateNavigationLimits(instance);
                            return;
                        }

                        if (!e.target.closest('.flatpickr-custom-month-menu')) {
                            closeMonthMenu(instance);
                        }
                    });
                }

                // Year input bounds & keyboard protection
                const yearInput = instance.yearElements && instance.yearElements[0];
                if (yearInput && !yearInput._hasBoundEvents) {
                    yearInput._hasBoundEvents = true;
                    const currentYear = new Date().getFullYear();
                    yearInput.min = currentYear;

                    yearInput.addEventListener('keydown', function (e) {
                        if (e.key === 'ArrowDown' && parseInt(this.value, 10) <= currentYear) {
                            e.preventDefault();
                        }
                    });

                    yearInput.addEventListener('change', function () {
                        if (parseInt(this.value, 10) < currentYear) {
                            this.value = currentYear;
                            instance.changeYear(currentYear);
                        }
                        updateNavigationLimits(instance);
                    });
                }

                // Global outside click handler
                document.addEventListener('click', function (e) {
                    if (instance.calendarContainer && !instance.calendarContainer.contains(e.target)) {
                        closeMonthMenu(instance);
                    }
                });
            }

            function closeMonthMenu(instance) {
                if (!instance || !instance.calendarContainer) return;
                const menu = instance.calendarContainer.querySelector('.flatpickr-custom-month-menu');
                const monthSpan = instance.calendarContainer.querySelector('.cur-month');
                if (menu) menu.classList.remove('is-visible');
                if (monthSpan) monthSpan.classList.remove('is-open');
            }

            function updateNavigationLimits(instance) {
                if (!instance || !instance.calendarContainer) return;
                const today = new Date();
                const currentRealYear = today.getFullYear();
                const currentRealMonth = today.getMonth();

                // 1. Enforce minimum year constraints
                const yearInput = instance.yearElements && instance.yearElements[0];
                if (yearInput) {
                    yearInput.min = currentRealYear;
                    if (parseInt(yearInput.value, 10) < currentRealYear) {
                        yearInput.value = currentRealYear;
                        instance.changeYear(currentRealYear);
                    }
                }

                if (instance.currentYear < currentRealYear) {
                    instance.changeYear(currentRealYear);
                }

                // If in current year and month is in the past, jump to current month
                if (instance.currentYear === currentRealYear && instance.currentMonth < currentRealMonth) {
                    instance.jumpToDate(new Date(currentRealYear, currentRealMonth, 1), true);
                }

                // 2. Disable left arrow (<) if displaying current month of current year (or earlier)
                const isPresentMonth = (instance.currentYear === currentRealYear && instance.currentMonth <= currentRealMonth);
                if (instance.prevMonthNav) {
                    if (isPresentMonth) {
                        instance.prevMonthNav.classList.add('nav-disabled');
                        instance.prevMonthNav.setAttribute('aria-disabled', 'true');
                    } else {
                        instance.prevMonthNav.classList.remove('nav-disabled');
                        instance.prevMonthNav.removeAttribute('aria-disabled');
                    }
                }

                // 3. Disable year down arrow (.arrowDown) if currently at or below current year
                const downArrow = instance.calendarContainer.querySelector('.numInputWrapper .arrowDown');
                if (downArrow) {
                    if (instance.currentYear <= currentRealYear) {
                        downArrow.classList.add('arrow-disabled');
                    } else {
                        downArrow.classList.remove('arrow-disabled');
                    }
                }

                // 4. Update custom month menu states (gray out past months in current year)
                const monthMenu = instance.calendarContainer.querySelector('.flatpickr-custom-month-menu');
                if (monthMenu) {
                    const buttons = monthMenu.querySelectorAll('.month-grid-btn');
                    buttons.forEach((btn) => {
                        const m = parseInt(btn.dataset.month, 10);
                        const isPast = (instance.currentYear === currentRealYear && m < currentRealMonth);
                        const isCurrent = (m === instance.currentMonth);

                        btn.classList.toggle('is-disabled', isPast);
                        btn.classList.toggle('is-active', isCurrent);
                        if (isPast) {
                            btn.setAttribute('disabled', 'disabled');
                        } else {
                            btn.removeAttribute('disabled');
                        }
                    });
                }
            }

            // Service Tier Change Handler: refresh slots if a date is selected
            $('#appt-service').on('change', function () {
                const currentDate = $('#appt-date').val();
                if (currentDate) {
                    fetchAndRenderSlots(currentDate, $(this).val());
                }
            });

            // Fetch booked slots from AJAX endpoint
            function fetchAndRenderSlots(dateStr, service) {
                const container = $('#timeSlotsContainer');
                const statusText = $('#slotStatusText');
                const timeInput = $('#appt-time');

                timeInput.val('');
                statusText.html('<span style="color: var(--text-muted);">Checking availability...</span>');
                container.html(`
                    <div class="slot-placeholder">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon">
                            <line x1="12" y1="2" x2="12" y2="6"></line>
                            <line x1="12" y1="18" x2="12" y2="22"></line>
                            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                            <line x1="2" y1="12" x2="6" y2="12"></line>
                            <line x1="18" y1="12" x2="22" y2="12"></line>
                            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                        </svg>
                        <span>Scanning schedule for ${dateStr}...</span>
                    </div>
                `);

                $.ajax({
                    url: 'api/slots',
                    type: 'GET',
                    dataType: 'json',
                    data: {
                        ajax_get_slots: 1,
                        date: dateStr,
                        service: service
                    },
                    success: function (res) {
                        if (res && res.success) {
                            if (res.is_blackout) {
                                container.html(`<div class="slot-placeholder" style="color: #ef4444; font-weight: 600;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;">
                                        <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                    <span>${res.message}</span>
                                </div>`);
                                statusText.text('Unavailable');
                                return;
                            }
                            renderTimeSlots(dateStr, res.booked_service_slots || [], res.user_conflict_slots || []);
                        } else {
                            container.html('<div class="slot-placeholder" style="color: #991b1b;">Failed to inspect slots. Please retry.</div>');
                            statusText.text('Error');
                        }
                    },
                    error: function () {
                        container.html('<div class="slot-placeholder" style="color: #991b1b;">Network error loading schedule.</div>');
                        statusText.text('Error');
                    }
                });
            }

            // Render interactive time slot pills
            function renderTimeSlots(dateStr, bookedSlots, userConflicts) {
                const container = $('#timeSlotsContainer');
                const statusText = $('#slotStatusText');
                
                // 30-minute intervals within business hours (09:00 AM - 04:30 PM)
                const allSlots = [
                    '09:00', '09:30', '10:00', '10:30',
                    '11:00', '11:30', '12:00', '12:30',
                    '13:00', '13:30', '14:00', '14:30',
                    '15:00', '15:30', '16:00', '16:30'
                ];

                const now = new Date();
                const todayYMD = now.getFullYear() + '-' + 
                                 String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                                 String(now.getDate()).padStart(2, '0');
                const isToday = (dateStr === todayYMD);

                let html = '';
                let availableCount = 0;

                allSlots.forEach(slot => {
                    const parts = slot.split(':');
                    const h = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10);
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const displayHour = h % 12 === 0 ? 12 : h % 12;
                    const displayTime = String(displayHour).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' ' + ampm;

                    const isBooked = bookedSlots.includes(slot) || userConflicts.includes(slot);
                    const isLunchBreak = (slot === '12:00' || slot === '12:30');

                    let isPast = false;
                    if (isToday) {
                        const slotDate = new Date();
                        slotDate.setHours(h, m, 0, 0);
                        if (slotDate <= now) {
                            isPast = true;
                        }
                    }

                    if (isLunchBreak) {
                        html += `
                            <button type="button" class="time-slot-pill" disabled title="Lunch Break" style="background: var(--surface-hover); opacity: 0.7;">
                                <span>${displayTime}</span>
                                <span class="slot-badge-taken" style="background: var(--border); color: var(--text-muted);">Lunch</span>
                            </button>
                        `;
                    } else if (isBooked) {
                        html += `
                            <button type="button" class="time-slot-pill booked" disabled title="Slot already reserved">
                                <span>${displayTime}</span>
                                <span class="slot-badge-taken">Booked</span>
                            </button>
                        `;
                    } else if (isPast) {
                        html += `
                            <button type="button" class="time-slot-pill" disabled title="Past operating time">
                                <span>${displayTime}</span>
                            </button>
                        `;
                    } else {
                        availableCount++;
                        html += `
                            <button type="button" class="time-slot-pill available" data-time="${slot}">
                                <span>${displayTime}</span>
                            </button>
                        `;
                    }
                });

                container.html(html);

                if (availableCount > 0) {
                    statusText.text(availableCount + ' slot' + (availableCount > 1 ? 's' : '') + ' open');
                } else {
                    statusText.html('<span style="color: #991b1b; font-weight: 600;">No available slots</span>');
                }
            }

            // Click Handler: Select an available slot
            $(document).on('click', '.time-slot-pill.available', function () {
                $('.time-slot-pill').removeClass('selected');
                $(this).addClass('selected');
                const chosenTime = $(this).data('time');
                $('#appt-time').val(chosenTime);
                const display = $(this).find('span').first().text();
                $('#slotStatusText').html('Selected: <strong style="color: var(--text-primary);">' + display + '</strong>');
            });

            // -------------------------------------------------------------
            // Phone Number Realtime Validation & Studio Formatting
            // -------------------------------------------------------------
            const phoneInput = $('#appt-phone');
            const phoneErrorMsg = $('#phoneErrorMsg');
            const phoneInputHint = $('#phoneInputHint');

            function formatPhoneNumber(value) {
                // Strip all non-digits
                let digits = value.replace(/\D/g, '');
                if (digits.length > 11) digits = digits.slice(0, 11);

                // Format: 09XX XXX XXXX
                if (digits.length <= 4) {
                    return digits;
                } else if (digits.length <= 7) {
                    return digits.slice(0, 4) + ' ' + digits.slice(4);
                } else {
                    return digits.slice(0, 4) + ' ' + digits.slice(4, 7) + ' ' + digits.slice(7);
                }
            }

            function validatePhoneNumber() {
                const raw = phoneInput.val().trim();
                const digits = raw.replace(/\D/g, '');

                if (digits.length === 0) {
                    phoneInput.addClass('is-invalid');
                    phoneErrorMsg.find('span').text('Mobile number is required for SMS updates');
                    phoneErrorMsg.show();
                    phoneInputHint.hide();
                    return false;
                }

                if (!digits.startsWith('09')) {
                    phoneInput.addClass('is-invalid');
                    phoneErrorMsg.find('span').text('Must start with 09 (e.g. 0917 123 4567)');
                    phoneErrorMsg.show();
                    phoneInputHint.hide();
                    return false;
                }

                if (digits.length < 11) {
                    phoneInput.addClass('is-invalid');
                    phoneErrorMsg.find('span').text('Incomplete: 11 digits required (' + digits.length + '/11 entered)');
                    phoneErrorMsg.show();
                    phoneInputHint.hide();
                    return false;
                }

                phoneInput.removeClass('is-invalid');
                phoneErrorMsg.hide();
                phoneInputHint.show();
                return true;
            }

            // "Reward Early, Punish Late" Validation Pattern:
            // 1. Format keystrokes smoothly while typing without yelling errors.
            // 2. If an error is already active and the user completes the 11 digits, clear it instantly.
            phoneInput.on('input', function () {
                const currentVal = $(this).val();
                const formatted = formatPhoneNumber(currentVal);
                if (currentVal !== formatted) {
                    $(this).val(formatted);
                }

                const digits = $(this).val().replace(/\D/g, '');

                // Reward early: clear active error the moment 11 valid digits are reached
                if (phoneInput.hasClass('is-invalid')) {
                    if (digits.startsWith('09') && digits.length === 11) {
                        phoneInput.removeClass('is-invalid');
                        phoneErrorMsg.hide();
                        phoneInputHint.show();
                    }
                }
            });

            // Punish late: only check for incompleteness once the user leaves the field
            phoneInput.on('blur', function () {
                const raw = $(this).val().trim();
                if (raw.length > 0) {
                    validatePhoneNumber();
                } else {
                    // Reset to neutral hint if left completely blank
                    phoneInput.removeClass('is-invalid');
                    phoneErrorMsg.hide();
                    phoneInputHint.show();
                }
            });

            // Form Submit Guard: Ensure valid phone & time slot
            $('#bookingForm').on('submit', function (e) {
                let isValid = true;

                if (!validatePhoneNumber()) {
                    isValid = false;
                    phoneInput.focus();
                }

                if (!$('#appt-date').val()) {
                    isValid = false;
                    const dateInputWrapper = $('#appt-date').closest('.date-input-wrapper').length ? $('#appt-date').closest('.date-input-wrapper') : $('#appt-date');
                    dateInputWrapper.find('.flatpickr-input').css('border-color', '#e11d48');
                    setTimeout(() => {
                        dateInputWrapper.find('.flatpickr-input').css('border-color', '');
                    }, 2500);
                }

                if (!$('#appt-time').val()) {
                    isValid = false;
                    $('#slotStatusText').html('<span style="color: #e11d48; font-weight: 700;">Please select an open time slot</span>');
                    $('#timeSlotsContainer').css('outline', '2px solid #e11d48').css('border-radius', '8px');
                    setTimeout(() => {
                        $('#timeSlotsContainer').css('outline', 'none');
                    }, 2500);
                }

                if (!isValid) {
                    e.preventDefault();
                    return false;
                }

                // Tactile feedback: lock submit button and show spinner to prevent duplicate submissions
                const submitBtn = $('#bookingSubmitBtn');
                submitBtn.prop('disabled', true).addClass('is-loading');
                submitBtn.find('.btn-text').text('Processing Drop-off...');
                submitBtn.find('.btn-icon').replaceWith(`
                    <svg class="btn-spinner" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                        <path d="M12 2a10 10 0 0 1 10 10"></path>
                    </svg>
                `);
            });

            // -------------------------------------------------------------
            // Custom Service Tier Dropdown Handler
            // -------------------------------------------------------------
            const tierDropdown = $('#customTierDropdown');
            const tierTrigger = tierDropdown.find('.tier-trigger');
            const tierInput = $('#appt-service');

            tierTrigger.on('click', function (e) {
                e.stopPropagation();
                
                const wasOpen = tierDropdown.hasClass('is-open');
                
                if (!wasOpen) {
                    const rect = this.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    if (spaceBelow < 250) {
                        tierDropdown.addClass('dropup');
                    } else {
                        tierDropdown.removeClass('dropup');
                    }
                }
                
                tierDropdown.toggleClass('is-open');
                const isOpen = tierDropdown.hasClass('is-open');
                $(this).attr('aria-expanded', isOpen ? 'true' : 'false');
            });

            tierDropdown.on('click', '.tier-option', function (e) {
                e.stopPropagation();
                const option = $(this);
                const val = option.data('value');
                const name = option.find('.tier-name').text();

                tierDropdown.find('.tier-option').removeClass('selected');
                option.addClass('selected');

                tierInput.val(val);
                tierTrigger.find('.tier-trigger-title').text(name);

                tierDropdown.removeClass('is-open');
                tierTrigger.attr('aria-expanded', 'false');

                // Trigger change to update time slots
                tierInput.trigger('change');
            });

            $(document).on('click', function () {
                tierDropdown.removeClass('is-open');
                tierTrigger.attr('aria-expanded', 'false');
            });

            $(document).on('keydown', function (e) {
                if (e.key === 'Escape') {
                    tierDropdown.removeClass('is-open');
                    tierTrigger.attr('aria-expanded', 'false');
                }
            });

            // -------------------------------------------------------------
            // Clear entrance animation once completed to prevent style collisions
            $(document).on('animationend', '.monolith-modal-card', function (e) {
                if (e.originalEvent && e.originalEvent.animationName === 'modalScaleIn') {
                    $(this).css('animation', 'none');
                }
            });

            function openDashboardModal(modalSelector) {
                const modal = $(modalSelector);
                modal.find('.monolith-modal-card').removeClass('modal-static-pulse').css('animation', '');
                modal.addClass('is-active');
            }

            // Custom Monolith Modal for Appointment Cancellation
            // -------------------------------------------------------------
            function closeCancelModal() {
                $('#cancelConfirmModal').removeClass('is-active');
                $('#modalCancelReqId').val('');
            }

            $(document).on('click', '.trigger-cancel-modal', function (e) {
                e.preventDefault();
                const reqId = $(this).data('id');
                const reqDate = $(this).data('date');

                if (!reqId) return;

                $('#modalCancelReqId').val(reqId);
                if (reqDate) {
                    $('#cancelModalSubtext').html('Are you sure you want to cancel your reservation for <strong style="white-space: nowrap;">' + reqDate + '</strong>? This action cannot be undone.');
                } else {
                    $('#cancelModalSubtext').text('Are you sure you want to cancel this appointment? This action cannot be undone.');
                }
                openDashboardModal('#cancelConfirmModal');
            });

            $(document).on('click', '.dismiss-cancel-modal', function (e) {
                e.preventDefault();
                closeCancelModal();
            });

            $('#cancelConfirmModal').on('click', function (e) {
                if ($(e.target).is('#cancelConfirmModal')) {
                    closeCancelModal();
                }
            });

            $(document).on('keydown', function (e) {
                if (e.key === 'Escape' && $('#cancelConfirmModal').hasClass('is-active')) {
                    closeCancelModal();
                }
            });

            $('#cancelRequestForm').on('submit', function (e) {
                const reqId = $('#modalCancelReqId').val();
                if (!reqId || String(reqId).trim() === '' || reqId === '0') {
                    e.preventDefault();
                    closeCancelModal();
                    return false;
                }
            });

            // -------------------------------------------------------------
            // Review Quote Modal Logic
            // -------------------------------------------------------------
            $(document).on('click', '.trigger-view-quote-modal', function(e) {
                e.preventDefault();
                const reqId = $(this).data('id');
                const amount = $(this).data('amount');
                const desc = $(this).data('desc');

                $('#viewQuoteReqId').val(reqId);
                $('#viewQuoteAmount').text('PHP ' + parseFloat(amount).toLocaleString('en-US', {minimumFractionDigits: 2}));
                $('#viewQuoteDescription').text(desc);

                openDashboardModal('#viewQuoteModal');
            });

            function closeViewQuoteModal() {
                $('#viewQuoteModal').removeClass('is-active');
            }

            $('.dismiss-view-quote-modal').on('click', closeViewQuoteModal);

            // Close quote modal on backdrop click
            $('#viewQuoteModal').on('click', function(e) {
                if ($(e.target).is('#viewQuoteModal')) {
                    closeViewQuoteModal();
                }
            });

            // Global Escape key handler for all modal dialogs
            $(document).on('keydown', function (e) {
                if (e.key === 'Escape') {
                    if ($('#viewQuoteModal').hasClass('is-active')) {
                        closeViewQuoteModal();
                    }
                    if ($('#cancelConfirmModal').hasClass('is-active')) {
                        closeCancelModal();
                    }
                }
            });

            // Kebab Menu Toggle Logic
            $(document).on('click', '.kebab-trigger', function (e) {
                e.stopPropagation();
                const container = $(this).closest('.kebab-menu-container');
                const wasOpen = container.hasClass('is-open');
                
                // Close all others
                $('.kebab-menu-container').removeClass('is-open dropup');
                
                if (!wasOpen) {
                    const dropdown = container.find('.kebab-dropdown');
                    const rect = this.getBoundingClientRect();
                    
                    dropdown.css({
                        position: 'fixed',
                        top: (rect.bottom + 4) + 'px',
                        bottom: 'auto',
                        left: 'auto',
                        right: (window.innerWidth - rect.right) + 'px',
                        zIndex: 9999
                    });

                    const spaceBelow = window.innerHeight - rect.bottom;
                    if (spaceBelow < 150) {
                        dropdown.css({
                            top: 'auto',
                            bottom: (window.innerHeight - rect.top + 4) + 'px'
                        });
                    }

                    container.addClass('is-open');
                }
            });

            // Close kebab when clicking outside or scrolling
            $(document).on('click', function () {
                $('.kebab-menu-container').removeClass('is-open dropup');
            });

            $(document).on('keydown', function (e) {
                if (e.key === 'Escape') {
                    $('.kebab-menu-container').removeClass('is-open dropup');
                }
            });

            document.addEventListener('scroll', function(e) {
                if (!document.querySelector('.kebab-menu-container.is-open')) return;
                if ($(e.target).closest('.kebab-dropdown').length === 0) {
                    $('.kebab-menu-container').removeClass('is-open dropup');
                }
            }, true);

            // -------------------------------------------------------------
            // Document Preview Lightbox Modal
            // -------------------------------------------------------------
            function closeDocPreviewModal() {
                const modal = $('#documentPreviewModal');
                modal.removeClass('is-active');
                $('#docPreviewImg').removeClass('is-loaded').hide().attr('src', '');
                $('#docPreviewFrame').hide().attr('src', '');
                $('#docPreviewError').hide();
                $('#docPreviewSpinner').hide();
            }

            $(document).on('click', '.btn-view-doc', function (e) {
                // If user held Ctrl / Cmd or middle-clicked, allow native browser tab opening
                if (e.ctrlKey || e.metaKey || e.which === 2) {
                    return;
                }

                e.preventDefault();
                const docUrl = $(this).attr('href');
                const docName = $(this).data('doc-name') || '';

                if (!docUrl) return;

                const modal = $('#documentPreviewModal');
                const spinner = $('#docPreviewSpinner');
                const img = $('#docPreviewImg');
                const frame = $('#docPreviewFrame');
                const errorBox = $('#docPreviewError');
                const extLink = $('#docPreviewExternalLink');
                const filenameLabel = $('#docPreviewFilename');

                // Reset modal state
                img.removeClass('is-loaded').hide().attr('src', '');
                frame.hide().attr('src', '');
                errorBox.hide();
                spinner.show();

                // Set headers & links
                extLink.attr('href', docUrl);
                filenameLabel.text(docName ? docName.split('/').pop() : 'Attached File');

                openDashboardModal('#documentPreviewModal');

                const isPdf = docName.toLowerCase().endsWith('.pdf') || docUrl.toLowerCase().includes('.pdf');

                if (isPdf) {
                    frame.attr('src', docUrl);
                    frame.off('load').on('load', function () {
                        spinner.hide();
                        frame.show();
                    });
                    frame.off('error').on('error', function () {
                        spinner.hide();
                        errorBox.show();
                        $('#docPreviewErrorBtn').attr('href', docUrl);
                    });
                } else {
                    const preloadImg = new Image();
                    preloadImg.onload = function () {
                        spinner.hide();
                        img.attr('src', docUrl).show();
                        // Trigger CSS fade-in
                        setTimeout(function () {
                            img.addClass('is-loaded');
                        }, 20);
                    };
                    preloadImg.onerror = function () {
                        spinner.hide();
                        errorBox.show();
                        $('#docPreviewErrorBtn').attr('href', docUrl);
                    };
                    preloadImg.src = docUrl;
                }
            });

            $(document).on('click', '.dismiss-doc-modal', function (e) {
                e.preventDefault();
                closeDocPreviewModal();
            });

            $('#documentPreviewModal').on('click', function (e) {
                if ($(e.target).is('#documentPreviewModal')) {
                    closeDocPreviewModal();
                }
            });

            $(document).on('keydown', function (e) {
                if (e.key === 'Escape' && $('#documentPreviewModal').hasClass('is-active')) {
                    closeDocPreviewModal();
                }
            });
        });