$(document).ready(function () {
            // Auto-dismiss success alerts after 5 seconds
            setTimeout(function() {
                $('.alert-banner').fadeOut(500, function() { $(this).remove(); });
            }, 5000);

            // Cohesive Empty States matching User Dashboard Service Registry
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

            const tableEmptyTotalHtml = `
                <div class="empty-registry-state in-table">
                    <div class="empty-registry-icon">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                        </svg>
                    </div>
                    <h3 class="empty-registry-title">No repair bookings yet</h3>
                    <p class="empty-registry-desc">There are currently no repair booking requests in the dispatch registry.</p>
                </div>
            `;

            // Initialize Master Ledger DataTable with 2-state toggle sorting
            let table = new DataTable('#sortableAdminTable', {
                order: [[2, 'desc']], // Most upcoming/recent schedule first
                pageLength: 8,
                lengthChange: false,
                layout: {
                    topStart: null,
                    topEnd: null
                },
                language: {
                    search: "",
                    searchPlaceholder: "Search reservations...",
                    zeroRecords: tableEmptyFilterHtml,
                    emptyTable: tableEmptyTotalHtml
                },
                columnDefs: [
                    { targets: '_all', orderSequence: ['asc', 'desc'] },
                    { targets: 2, orderSequence: ['desc', 'asc'] },
                    { targets: [4, 6], orderable: false } // Attachment & Actions non-sortable
                ]
            });

            // Initialize Flatpickr for Modals
            if (typeof flatpickr !== 'undefined') {
                const dateConfig = {
                    minDate: "today",
                    dateFormat: "Y-m-d",
                    altInput: true,
                    altFormat: "F j, Y (D)",
                    disableMobile: true,
                    disable: [
                        function (date) {
                            return (date.getDay() === 0 || date.getDay() === 6);
                        }
                    ],
                    onReady: function (selectedDates, dateStr, instance) {
                        initCustomMonthPicker(instance);
                        updateNavigationLimits(instance);
                    },
                    onMonthChange: function (selectedDates, dateStr, instance) {
                        updateNavigationLimits(instance);
                    },
                    onYearChange: function (selectedDates, dateStr, instance) {
                        updateNavigationLimits(instance);
                    },
                    onOpen: function (selectedDates, dateStr, instance) {
                        updateNavigationLimits(instance);
                    },
                    onClose: function (selectedDates, dateStr, instance) {
                        closeMonthMenu(instance);
                    },
                    onChange: function (selectedDates, dateStr, instance) {
                        if (instance.element.id === 'rescheduleDate' && dateStr) {
                            fetchAndRenderAdminSlots(dateStr);
                        }
                    }
                };
                flatpickr("#rescheduleDate", dateConfig);
                flatpickr("#newBlackoutDate", dateConfig);
            }

            // Dedicated Search Input Hook
            $('#adminSearchInput').on('input', function () {
                table.search(this.value).draw();
            });

            // Custom DataTables Search Plugin to filter by live status
            $.fn.dataTable.ext.search.push(function(settings, searchData, index, rowData, counter) {
                const activeStatus = $('.tab-pill.active').data('status');
                if (!activeStatus) return true; // 'All' tab
                
                const rowNode = settings.aoData[index].nTr;
                if (!rowNode) return true;
                
                const currentStatus = $(rowNode).find('.custom-status-dropdown').attr('data-current');
                return currentStatus === activeStatus;
            });

            // Interactive Segmented Filter Tabs
            $('.tab-pill').on('click', function () {
                $('.tab-pill').removeClass('active');
                $(this).addClass('active');

                // Simply redraw the table. The custom search plugin will handle the filtering based on the real-time DOM state.
                // We clear any built-in column search first to prevent conflicts.
                table.column(5).search('').draw();
            });

            // Delegated click handler to reset table filters and search
            $(document).on('click', '.table-empty-reset-btn', function (e) {
                e.preventDefault();
                $('#adminSearchInput').val('');
                table.search('');
                $('.filter-segmented-bar .tab-pill[data-status=""]').trigger('click');
            });

            // ---------------------------------------------------------
            // Custom Status Dropdown Toggle & Selection Handlers
            // ---------------------------------------------------------
            $(document).on('click', '.status-trigger', function (e) {
                e.stopPropagation();
                const trigger = $(this);
                const wrapper = trigger.closest('.status-auto-wrapper');
                const wasOpen = wrapper.hasClass('is-open');

                // Close all other open dropdowns
                $('.status-auto-wrapper').removeClass('is-open dropup');
                $('.status-trigger').attr('aria-expanded', 'false');
                $('table.studio-admin-table tbody tr').removeClass('has-active-dropdown');

                if (!wasOpen) {
                    const menu = wrapper.find('.status-menu');
                    const rect = trigger[0].getBoundingClientRect();
                    
                    // Default to opening downwards
                    menu.css({
                        position: 'fixed',
                        top: (rect.bottom + 4) + 'px',
                        bottom: 'auto',
                        left: rect.left + 'px',
                        zIndex: 9999
                    });

                    // Check available viewport space below the trigger button
                    const spaceBelow = window.innerHeight - rect.bottom;
                    if (spaceBelow < 250) {
                        // Open upwards (dropup)
                        wrapper.addClass('dropup');
                        menu.css({
                            top: 'auto',
                            bottom: (window.innerHeight - rect.top + 4) + 'px'
                        });
                    } else {
                        wrapper.removeClass('dropup');
                    }

                    wrapper.addClass('is-open');
                    trigger.attr('aria-expanded', 'true');
                    trigger.closest('tr').addClass('has-active-dropdown');
                }
            });

            // Close dropdowns on outside click, Escape, or scroll
            $(document).on('click', function () {
                $('.status-auto-wrapper, .kebab-menu-container').removeClass('is-open dropup');
                $('.status-trigger').attr('aria-expanded', 'false');
                $('table.studio-admin-table tbody tr').removeClass('has-active-dropdown');
            });

            $(document).on('keydown', function (e) {
                if (e.key === 'Escape') {
                    $('.status-auto-wrapper, .kebab-menu-container').removeClass('is-open dropup');
                    $('.status-trigger').attr('aria-expanded', 'false');
                    $('table.studio-admin-table tbody tr').removeClass('has-active-dropdown');
                }
            });

            document.addEventListener('scroll', function(e) {
                if (!document.querySelector('.status-auto-wrapper.is-open, .kebab-menu-container.is-open')) return;
                if ($(e.target).closest('.status-menu, .kebab-dropdown').length === 0) {
                    $('.status-auto-wrapper, .kebab-menu-container').removeClass('is-open dropup');
                    $('.status-trigger').attr('aria-expanded', 'false');
                    $('table.studio-admin-table tbody tr').removeClass('has-active-dropdown');
                }
            }, true);

            // Status Option Selection & Auto-Save
            $(document).on('click', '.status-option', function (e) {
                e.stopPropagation();
                const option = $(this);
                const wrapper = option.closest('.status-auto-wrapper');
                const dropdown = wrapper.find('.custom-status-dropdown');
                const reqId = dropdown.data('id');
                const previousStatus = dropdown.attr('data-current');
                const newStatus = option.data('value');
                const td = wrapper.closest('td');

                // Close dropdown
                wrapper.removeClass('is-open dropup');
                wrapper.find('.status-trigger').attr('aria-expanded', 'false');
                wrapper.closest('tr').removeClass('has-active-dropdown');

                if (newStatus === previousStatus) {
                    return;
                }

                // Update active UI immediately (Optimistic Update)
                dropdown.find('.status-option').removeClass('selected');
                option.addClass('selected');

                const trigger = dropdown.find('.status-trigger');
                trigger.removeClass('status-trigger-pending status-trigger-confirmed status-trigger-in_progress status-trigger-for_pickup status-trigger-completed status-trigger-cancelled')
                       .addClass('status-trigger-' + newStatus);
                trigger.find('.status-dot').removeClass('dot-pending dot-confirmed dot-in_progress dot-for_pickup dot-completed dot-cancelled')
                       .addClass('dot-' + newStatus);
                
                let formattedStatus = newStatus.replace(/_/g, ' ');
                // Capitalize each word
                formattedStatus = formattedStatus.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                trigger.find('.status-trigger-label').text(formattedStatus);

                $.ajax({
                    url: 'api/status',
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        ajax_update_status: 1,
                        csrf_token: $('meta[name="csrf-token"]').attr('content'),
                        request_id: reqId,
                        status: newStatus
                    },
                    success: function (res) {
                        if (res && res.success) {
                            dropdown.attr('data-current', newStatus);

                            // Update DOM attributes on td for DataTables search & ordering
                            td.attr('data-order', newStatus);
                            td.attr('data-filter', newStatus);
                            td.attr('data-search', newStatus);

                            // Tell DataTables to re-read row attributes without modifying the DOM
                            const row = table.row(td.closest('tr'));
                            row.invalidate('dom');
                            table.draw(false); // Instantly re-filter to hide row if it no longer matches the current tab

                            // Update KPI Numbers in Real-Time
                            if (res.counters) {
                                $('#kpi-total').text(String(res.counters.total).padStart(2, '0'));
                                $('#kpi-pending').text(String(res.counters.pending).padStart(2, '0'));
                                $('#kpi-confirmed').text(String(res.counters.confirmed).padStart(2, '0'));
                                $('#kpi-cancelled').text(String(res.counters.cancelled).padStart(2, '0'));

                                $('#tab-count-all').text(res.counters.total);
                                $('#tab-count-pending').text(res.counters.pending);
                                $('#tab-count-confirmed').text(res.counters.confirmed);
                                $('#tab-count-in_progress').text(res.counters.in_progress);
                                $('#tab-count-for_pickup').text(res.counters.for_pickup);
                                $('#tab-count-completed').text(res.counters.completed);
                                $('#tab-count-cancelled').text(res.counters.cancelled);
                            }

                            // Inject visual success banner
                            showAjaxSuccessBanner(res.message || 'Status updated successfully.');
                        } else {
                            // Rollback on server error
                            rollbackStatus(dropdown, previousStatus);
                        }
                    },
                    error: function () {
                        rollbackStatus(dropdown, previousStatus);
                    }
                });
            });

            function rollbackStatus(dropdown, prevStatus) {
                dropdown.find('.status-option').removeClass('selected');
                dropdown.find(`.status-option[data-value="${prevStatus}"]`).addClass('selected');

                const trigger = dropdown.find('.status-trigger');
                trigger.removeClass('status-trigger-pending status-trigger-confirmed status-trigger-in_progress status-trigger-for_pickup status-trigger-completed status-trigger-cancelled')
                       .addClass('status-trigger-' + prevStatus);
                trigger.find('.status-dot').removeClass('dot-pending dot-confirmed dot-in_progress dot-for_pickup dot-completed dot-cancelled')
                       .addClass('dot-' + prevStatus);
                       
                let formattedStatus = prevStatus.replace(/_/g, ' ');
                formattedStatus = formattedStatus.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                trigger.find('.status-trigger-label').text(formattedStatus);
            }
            function showAjaxErrorBanner(message) {
                $('.alert-banner').remove();
                const banner = $(`
                    <div class="alert-banner" style="display: none; background-color: #fef2f2; border-color: #fecaca; color: #991b1b;">
                        <div class="alert-content">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            <span>${message}</span>
                        </div>
                        <button type="button" class="alert-dismiss-btn" style="color: #991b1b; opacity: 0.7;" onclick="this.parentElement.remove()" aria-label="Dismiss notification">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                `);
                $('.deck-wrapper').prepend(banner);
                banner.fadeIn(300);
                setTimeout(function() {
                    banner.fadeOut(500, function() { $(this).remove(); });
                }, 5000);
            }
            function showAjaxSuccessBanner(message) {
                $('.alert-banner').remove();
                const banner = $(`
                    <div class="alert-banner" style="display: none;">
                        <div class="alert-content">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>${message}</span>
                        </div>
                        <button type="button" class="alert-dismiss-btn" onclick="this.parentElement.remove()" aria-label="Dismiss notification">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                `);
                $('.deck-wrapper').prepend(banner);
                banner.fadeIn(300);
                setTimeout(function() {
                    banner.fadeOut(500, function() { $(this).remove(); });
                }, 5000);
            }

            // ---------------------------------------------------------
            // Real-time Heartbeat Polling for New Requests
            // ---------------------------------------------------------
            let currentMaxId = 0;
            
            // Extract the highest ID currently rendered in the table
            $('table.studio-admin-table tbody tr').each(function() {
                const idCell = $(this).find('td:first-child').attr('data-order');
                const rowId = parseInt(idCell, 10);
                if (!isNaN(rowId) && rowId > currentMaxId) {
                    currentMaxId = rowId;
                }
            });

            // Poll every 15 seconds
            setInterval(function() {
                if (currentMaxId === 0) return; // Skip if table is completely empty initially
                
                $.ajax({
                    url: 'api/check-new',
                    type: 'GET',
                    data: { last_id: currentMaxId },
                    dataType: 'json',
                    success: function(res) {
                        if (res && res.success && res.has_new) {
                            currentMaxId = res.max_id; // update to prevent duplicate banners
                            showRefreshBanner();
                        }
                    }
                });
            }, 15000);

            function showRefreshBanner() {
                if ($('.alert-banner.refresh-banner').length > 0) return;
                const banner = $(`
                    <div class="alert-banner refresh-banner" style="display: none; background: #09090b; color: #fff; border-color: #09090b; cursor: pointer; justify-content: center;" onclick="window.location.reload();">
                        <div class="alert-content">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            <span>New Drop-off Request received! Click here to refresh the dispatch board.</span>
                        </div>
                    </div>
                `);
                $('.deck-wrapper').prepend(banner);
                banner.fadeIn(300);
            }

            // ---------------------------------------------------------
            // Dynamic Quotation Button Visibility (Client Local Time)
            // ---------------------------------------------------------
            function evaluateDynamicQuoteButtons() {
                const now = new Date();
                $('.dynamic-quote-btn').each(function() {
                    // Replace dashes with slashes for cross-browser safe parsing (e.g. Safari)
                    const reqDateStr = $(this).data('datetime').replace(/-/g, '/');
                    const apptTime = new Date(reqDateStr);
                    
                    if (apptTime < now) {
                        $(this).show();
                    } else {
                        $(this).hide();
                    }
                });
            }

            // Run once on load
            evaluateDynamicQuoteButtons();
            
            // Re-evaluate every minute just in case they leave the tab open
            setInterval(evaluateDynamicQuoteButtons, 60000);

            // Re-evaluate when DataTables redraws (e.g., pagination, search, sort)
            table.on('draw', function() {
                evaluateDynamicQuoteButtons();
            });

            // Clear entrance animation once completed so it never collides with pulse feedback
            $(document).on('animationend', '.monolith-modal-card', function (e) {
                if (e.originalEvent && e.originalEvent.animationName === 'modalScaleIn') {
                    $(this).css('animation', 'none');
                }
            });

            function openModal(modalSelector) {
                const modal = $(modalSelector);
                modal.find('.monolith-modal-card').removeClass('modal-static-pulse').css('animation', '');
                modal.addClass('is-active');
            }

            function pulseModalCard(modalSelector) {
                const card = $(modalSelector).find('.monolith-modal-card');
                if (!card.length) return;
                
                // Ensure entrance animation is explicitly inactive
                card.css('animation', 'none');
                card.removeClass('modal-static-pulse');
                
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        card.addClass('modal-static-pulse');
                        card.one('animationend', function (e) {
                            if (e.originalEvent && e.originalEvent.animationName === 'modalStaticPulse') {
                                card.removeClass('modal-static-pulse');
                                card.css('animation', 'none');
                            }
                        });
                    });
                });
            }

            function isQuoteFormDirty() {
                const initialAmount = String($('#quoteModal').data('initial-amount') || '');
                const initialDesc = String($('#quoteModal').data('initial-desc') || '').trim();
                const currentAmount = String($('#quoteAmount').val() || '');
                const currentDesc = String($('#quoteDescription').val() || '').trim();

                return currentAmount !== initialAmount || currentDesc !== initialDesc;
            }

            function isRescheduleFormDirty() {
                const initialDate = $('#rescheduleModal').data('initial-date') || '';
                const initialTime = $('#rescheduleModal').data('initial-time') || '';
                const currentDate = $('#rescheduleDate').val() || '';
                const currentTime = $('#rescheduleTime').val() || '';
                const reasonVal = $('#rescheduleReason').val().trim();

                return !!(reasonVal || (currentDate && currentDate !== initialDate) || (currentTime && currentTime !== initialTime));
            }

            function isBlackoutFormDirty() {
                const dateVal = $('#newBlackoutDate').val();
                const reasonVal = $('#newBlackoutReason').val().trim();
                return !!(dateVal || reasonVal);
            }

            // ---------------------------------------------------------
            // Quotation Modal Logic
            // ---------------------------------------------------------
            $(document).on('click', '.trigger-quote-modal', function(e) {
                e.preventDefault();
                const reqId = $(this).data('id');
                
                // If it's an edit action, pre-fill data
                const existingAmount = $(this).data('amount');
                const existingDesc = $(this).data('desc');
                
                $('#quoteReqId').val(reqId);
                $('#quoteAmount').val(existingAmount || '');
                $('#quoteDescription').val(existingDesc || '');

                // Store baseline values for dirty-state detection
                $('#quoteModal').data('initial-amount', existingAmount ? String(existingAmount) : '');
                $('#quoteModal').data('initial-desc', existingDesc ? String(existingDesc).trim() : '');
                
                $('#quoteModalTitle').text(existingAmount ? 'Edit Quotation Price' : 'Set Quotation Price');
                openModal('#quoteModal');
            });

            $('.dismiss-quote-modal').on('click', function() {
                // Explicit Cancel button discards draft and resets
                $('#quoteAmount').val('');
                $('#quoteDescription').val('');
                $('#quoteModal').removeData('initial-amount').removeData('initial-desc');
                $('#quoteModal').removeClass('is-active');
            });

            // Dismiss quote modal on backdrop click with dirty-state guard
            $('#quoteModal').on('click', function(e) {
                if ($(e.target).is('#quoteModal')) {
                    if (isQuoteFormDirty()) {
                        pulseModalCard('#quoteModal');
                        return;
                    }
                    $('#quoteModal').removeClass('is-active');
                }
            });

            $('#issueQuoteForm').on('submit', function(e) {
                e.preventDefault();
                
                const amountVal = $('#quoteAmount').val();
                const descVal = $('#quoteDescription').val().trim();
                
                if (!amountVal || amountVal <= 0) {
                    showAjaxErrorBanner('Please enter a valid quotation amount.');
                    $('#quoteAmount').css('border-color', '#ef4444');
                    setTimeout(() => $('#quoteAmount').css('border-color', ''), 3000);
                    return;
                }
                
                if (!descVal) {
                    showAjaxErrorBanner('Please provide a description of the service or parts.');
                    $('#quoteDescription').css('border-color', '#ef4444');
                    setTimeout(() => $('#quoteDescription').css('border-color', ''), 3000);
                    return;
                }
                
                const btn = $(this).find('button[type="submit"]');
                const originalText = btn.text();
                btn.prop('disabled', true).text('Issuing...');

                $.ajax({
                    url: 'api/quote/issue',
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        csrf_token: $('meta[name="csrf-token"]').attr('content'),
                        request_id: $('#quoteReqId').val(),
                        amount: amountVal,
                        description: descVal
                    },
                    success: function(res) {
                        $('#quoteModal').removeClass('is-active');
                        btn.prop('disabled', false).text(originalText);
                        
                        if (res && res.success) {
                            showAjaxSuccessBanner(res.message);
                            setTimeout(function() { window.location.reload(); }, 1500);
                        } else {
                            showAjaxErrorBanner(res.message || 'Failed to issue quote.');
                        }
                    },
                    error: function() {
                        $('#quoteModal').removeClass('is-active');
                        btn.prop('disabled', false).text(originalText);
                        showAjaxErrorBanner('A server error occurred. Please try again.');
                    }
                });
            });

            // ---------------------------------------------------------
            // Reschedule Modal Logic
            // ---------------------------------------------------------
            $(document).on('click', '.trigger-reschedule-modal', function(e) {
                e.preventDefault();
                const reqId = $(this).data('id');
                const dt = $(this).data('datetime'); // YYYY-MM-DD HH:MM:SS
                
                $('#rescheduleReqId').val(reqId);
                
                let datePart = '';
                let timePart = '';
                if (dt) {
                    datePart = dt.split(' ')[0];
                    timePart = dt.split(' ')[1].substring(0, 5);
                    if (document.querySelector('#rescheduleDate')._flatpickr) {
                        document.querySelector('#rescheduleDate')._flatpickr.setDate(datePart);
                    } else {
                        $('#rescheduleDate').val(datePart);
                    }
                    $('#rescheduleTime').val(timePart);
                    // Fetch slots for this date
                    fetchAndRenderAdminSlots(datePart);
                }

                // Store baseline values for dirty-state detection
                $('#rescheduleModal').data('initial-date', datePart);
                $('#rescheduleModal').data('initial-time', timePart);
                
                $('#rescheduleReason').val('');
                openModal('#rescheduleModal');
            });

            $('.dismiss-reschedule-modal').on('click', function() {
                // Explicit Cancel button discards draft and resets
                $('#rescheduleReason').val('');
                $('#rescheduleModal').removeData('initial-date').removeData('initial-time');
                $('#rescheduleModal').removeClass('is-active');
            });

            // Dismiss reschedule modal on backdrop click with dirty-state guard
            $('#rescheduleModal').on('click', function(e) {
                if ($(e.target).is('#rescheduleModal')) {
                    if (isRescheduleFormDirty()) {
                        pulseModalCard('#rescheduleModal');
                        return;
                    }
                    $('#rescheduleModal').removeClass('is-active');
                }
            });

            $('#rescheduleForm').on('submit', function(e) {
                e.preventDefault();
                
                const dateVal = $('#rescheduleDate').val();
                const timeVal = $('#rescheduleTime').val();
                const reasonVal = $('#rescheduleReason').val().trim();
                
                if (!dateVal) {
                    showAjaxErrorBanner('Please select a new date for the appointment.');
                    $('#rescheduleDate').closest('.date-input-wrapper').find('.flatpickr-input.form-control.input').css('border-color', '#ef4444');
                    setTimeout(() => $('#rescheduleDate').closest('.date-input-wrapper').find('.flatpickr-input.form-control.input').css('border-color', ''), 3000);
                    return;
                }
                
                if (!timeVal) {
                    showAjaxErrorBanner('Please select an available time slot.');
                    $('#rescheduleTimeSlots').css({'border': '1px solid #ef4444', 'border-radius': 'var(--radius-md)', 'padding': '4px'});
                    setTimeout(() => $('#rescheduleTimeSlots').css({'border': '', 'border-radius': '', 'padding': ''}), 3000);
                    return;
                }
                
                if (!reasonVal) {
                    showAjaxErrorBanner('Please provide a reason for rescheduling.');
                    $('#rescheduleReason').css('border-color', '#ef4444');
                    setTimeout(() => $('#rescheduleReason').css('border-color', ''), 3000);
                    return;
                }
                
                const btn = $(this).find('button[type="submit"]');
                const originalText = btn.text();
                btn.prop('disabled', true).text('Rescheduling...');

                $.ajax({
                    url: 'api/requests/reschedule',
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        csrf_token: $('meta[name="csrf-token"]').attr('content'),
                        request_id: $('#rescheduleReqId').val(),
                        date: dateVal,
                        time: timeVal,
                        reason: reasonVal
                    },
                    success: function(res) {
                        $('#rescheduleModal').removeClass('is-active');
                        btn.prop('disabled', false).text(originalText);
                        
                        if (res && res.success) {
                            showAjaxSuccessBanner(res.message);
                            setTimeout(function() { window.location.reload(); }, 1500);
                        } else {
                            showAjaxErrorBanner(res.message || 'Failed to reschedule appointment.');
                        }
                    },
                    error: function() {
                        $('#rescheduleModal').removeClass('is-active');
                        btn.prop('disabled', false).text(originalText);
                        showAjaxErrorBanner('A server error occurred. Please try again.');
                    }
                });
            });

            // Kebab Menu Toggle Logic
            $(document).on('click', '.kebab-trigger', function (e) {
                e.stopPropagation();
                
                // If it's a status trigger inside status dropdown, ignore it here
                if ($(this).hasClass('status-trigger')) return;

                const container = $(this).closest('.kebab-menu-container');
                const wasOpen = container.hasClass('is-open');
                
                // Close all others
                $('.kebab-menu-container, .status-auto-wrapper').removeClass('is-open dropup');
                
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

            function escapeHtml(str) {
                if (!str) return '';
                return $('<div>').text(str).html();
            }

            // ---------------------------------------------------------
            // Blackout Dates Logic
            // ---------------------------------------------------------
            function loadBlackoutDates() {
                $.ajax({
                    url: 'api/blackout-dates',
                    type: 'GET',
                    dataType: 'json',
                    success: function(res) {
                        if (res && res.success) {
                            let rows = '';
                            if (res.data.length === 0) {
                                rows = '<tr><td colspan="3" style="padding: 12px 8px; text-align: center; color: var(--text-muted);">No upcoming blackout dates.</td></tr>';
                            } else {
                                res.data.forEach(function(item) {
                                    // Parse date string securely
                                    const d = new Date(item.blackout_date + 'T00:00:00');
                                    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                    rows += `
                                        <tr style="border-bottom: 1px solid var(--border);">
                                            <td style="padding: 8px;">${dateStr}</td>
                                            <td style="padding: 8px;">${escapeHtml(item.reason)}</td>
                                            <td style="padding: 8px; text-align: right;">
                                                <button type="button" class="btn-delete-blackout" data-id="${item.id}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 12px; font-weight: 600;">Remove</button>
                                            </td>
                                        </tr>
                                    `;
                                });
                            }
                            $('#blackoutTable tbody').html(rows);
                        }
                    },
                    error: function() {
                        $('#blackoutTable tbody').html('<tr><td colspan="3" style="padding: 12px 8px; text-align: center; color: #ef4444;">Failed to load blackout dates. Please retry.</td></tr>');
                    }
                });
            }

            $('.trigger-blackout-modal').on('click', function(e) {
                e.preventDefault();
                loadBlackoutDates();
                if (document.querySelector('#newBlackoutDate')._flatpickr) {
                    document.querySelector('#newBlackoutDate')._flatpickr.clear();
                } else {
                    $('#newBlackoutDate').val('');
                }
                $('#newBlackoutReason').val('');
                openModal('#blackoutModal');
            });

            $('.dismiss-blackout-modal').on('click', function() {
                // Explicit Close button discards any unadded draft
                if (document.querySelector('#newBlackoutDate')._flatpickr) {
                    document.querySelector('#newBlackoutDate')._flatpickr.clear();
                } else {
                    $('#newBlackoutDate').val('');
                }
                $('#newBlackoutReason').val('');
                $('#blackoutModal').removeClass('is-active');
            });

            // Dismiss blackout modal on backdrop click with dirty-state guard
            $('#blackoutModal').on('click', function(e) {
                if ($(e.target).is('#blackoutModal')) {
                    if (isBlackoutFormDirty()) {
                        pulseModalCard('#blackoutModal');
                        return;
                    }
                    $('#blackoutModal').removeClass('is-active');
                }
            });

            $('#addBlackoutForm').on('submit', function(e) {
                e.preventDefault();
                
                const dateVal = $('#newBlackoutDate').val();
                const reasonVal = $('#newBlackoutReason').val().trim();
                
                if (!dateVal) {
                    showAjaxErrorBanner('Please select a blackout date.');
                    $('#newBlackoutDate').closest('.date-input-wrapper').find('.flatpickr-input.form-control.input').css('border-color', '#ef4444');
                    setTimeout(() => $('#newBlackoutDate').closest('.date-input-wrapper').find('.flatpickr-input.form-control.input').css('border-color', ''), 3000);
                    return;
                }
                if (!reasonVal) {
                    showAjaxErrorBanner('Please provide a reason for the blackout date.');
                    $('#newBlackoutReason').css('border-color', '#ef4444');
                    setTimeout(() => $('#newBlackoutReason').css('border-color', ''), 3000);
                    return;
                }
                
                const btn = $(this).find('button[type="submit"]');
                const originalText = btn.text();
                btn.prop('disabled', true).text('Adding...');

                $.ajax({
                    url: 'api/blackout-dates/add',
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        csrf_token: $('meta[name="csrf-token"]').attr('content'),
                        date: dateVal,
                        reason: reasonVal
                    },
                    success: function(res) {
                        btn.prop('disabled', false).text(originalText);
                        if (res && res.success) {
                            if (document.querySelector('#newBlackoutDate')._flatpickr) {
                                document.querySelector('#newBlackoutDate')._flatpickr.clear();
                            } else {
                                $('#newBlackoutDate').val('');
                            }
                            $('#newBlackoutReason').val('');
                            loadBlackoutDates();
                        } else {
                            showAjaxErrorBanner(res.message || 'Failed to add blackout date.');
                        }
                    },
                    error: function() {
                        btn.prop('disabled', false).text(originalText);
                        showAjaxErrorBanner('A server error occurred. Please try again.');
                    }
                });
            });

            $(document).on('click', '.btn-delete-blackout', function() {
                const id = $(this).data('id');
                const dateText = $(this).closest('tr').find('td').first().text();
                
                $('#deleteBlackoutId').val(id);
                $('#deleteBlackoutDateText').text(dateText);
                
                // Hide blackout modal temporarily
                $('#blackoutModal').removeClass('is-active');
                openModal('#deleteBlackoutModal');
            });

            $('.dismiss-delete-blackout').on('click', function() {
                $('#deleteBlackoutModal').removeClass('is-active');
                // Re-open blackout modal
                openModal('#blackoutModal');
            });

            // Dismiss delete confirmation on backdrop click (return to blackout modal)
            $('#deleteBlackoutModal').on('click', function(e) {
                if ($(e.target).is('#deleteBlackoutModal')) {
                    $('#deleteBlackoutModal').removeClass('is-active');
                    openModal('#blackoutModal');
                }
            });

            $('#deleteBlackoutForm').on('submit', function(e) {
                e.preventDefault();
                const btn = $(this).find('button[type="submit"]');
                const originalText = btn.text();
                const id = $('#deleteBlackoutId').val();
                
                btn.prop('disabled', true).text('Removing...');
                
                $.ajax({
                    url: 'api/blackout-dates/delete',
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        csrf_token: $('meta[name="csrf-token"]').attr('content'),
                        id: id
                    },
                    success: function(res) {
                        btn.prop('disabled', false).text(originalText);
                        $('#deleteBlackoutModal').removeClass('is-active');
                        
                        if (res && res.success) {
                            loadBlackoutDates();
                            openModal('#blackoutModal');
                        } else {
                            showAjaxErrorBanner(res.message || 'Failed to remove date.');
                            openModal('#blackoutModal');
                        }
                    },
                    error: function() {
                        btn.prop('disabled', false).text(originalText);
                        showAjaxErrorBanner('A server error occurred.');
                    }
                });
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




            // Fetch booked slots from AJAX endpoint for Reschedule Modal
            function fetchAndRenderAdminSlots(dateStr) {
                const container = $('#rescheduleTimeSlots');
                const statusText = $('#rescheduleSlotStatus');
                const timeInput = $('#rescheduleTime');

                timeInput.val('');
                statusText.html('<span style="color: var(--text-muted);">Checking availability...</span>');
                container.html(`
                    <div class="slot-placeholder" style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 0; color: var(--text-muted); text-align: center;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon" style="margin-bottom: 8px; opacity: 0.5;">
                            <line x1="12" y1="2" x2="12" y2="6"></line>
                            <line x1="12" y1="18" x2="12" y2="22"></line>
                            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                            <line x1="2" y1="12" x2="6" y2="12"></line>
                            <line x1="18" y1="12" x2="22" y2="12"></line>
                            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                        </svg>
                        <span style="font-size: 12px; font-weight: 500;">Scanning schedule for ${dateStr}...</span>
                    </div>
                `);

                $.ajax({
                    url: 'api/slots',
                    type: 'GET',
                    dataType: 'json',
                    data: {
                        ajax_get_slots: 1,
                        date: dateStr,
                        service: '',
                        exclude_id: $('#rescheduleReqId').val()
                    },
                    success: function (res) {
                        if (res && res.success) {
                            if (res.is_blackout) {
                                container.html(`<div class="slot-placeholder" style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; padding: 24px 0; color: #ef4444; font-weight: 600;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom:8px;">
                                        <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                    <span>${res.message}</span>
                                </div>`);
                                statusText.text('Unavailable');
                                return;
                            }
                            renderAdminTimeSlots(dateStr, res.booked_service_slots || [], res.user_conflict_slots || []);
                        } else {
                            container.html('<div class="slot-placeholder" style="grid-column: 1 / -1; color: #991b1b; padding: 24px 0; text-align: center;">Failed to inspect slots. Please retry.</div>');
                            statusText.text('Error');
                        }
                    },
                    error: function () {
                        container.html('<div class="slot-placeholder" style="grid-column: 1 / -1; color: #991b1b; padding: 24px 0; text-align: center;">Network error loading schedule.</div>');
                        statusText.text('Error');
                    }
                });
            }

            // Render interactive time slot pills for Admin Modal
            function renderAdminTimeSlots(dateStr, bookedSlots, userConflicts) {
                const container = $('#rescheduleTimeSlots');
                const statusText = $('#rescheduleSlotStatus');
                
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
                            <button type="button" class="time-slot-pill admin-time-slot" disabled title="Lunch Break" style="background: var(--surface-hover); opacity: 0.7;">
                                <span>${displayTime}</span>
                                <span class="slot-badge-taken" style="background: var(--border); color: var(--text-muted);">Lunch</span>
                            </button>
                        `;
                    } else if (isBooked) {
                        html += `
                            <button type="button" class="time-slot-pill admin-time-slot booked" disabled title="Slot already reserved">
                                <span>${displayTime}</span>
                                <span class="slot-badge-taken">Booked</span>
                            </button>
                        `;
                    } else if (isPast) {
                        html += `
                            <button type="button" class="time-slot-pill admin-time-slot" disabled title="Past operating time">
                                <span>${displayTime}</span>
                            </button>
                        `;
                    } else {
                        availableCount++;
                        html += `
                            <button type="button" class="time-slot-pill admin-time-slot available" data-time="${slot}">
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

            $(document).on('click', '.admin-time-slot.available', function () {
                $('.admin-time-slot').removeClass('selected');
                $(this).addClass('selected');
                const chosenTime = $(this).data('time');
                $('#rescheduleTime').val(chosenTime);
                const display = $(this).find('span').first().text();
                $('#rescheduleSlotStatus').html('Selected: <strong style="color: var(--text-primary);">' + display + '</strong>');
            });

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

                openModal('#documentPreviewModal');

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

            // Global Escape key handler for all modal dialogs with dirty-state guards
            $(document).on('keydown', function (e) {
                if (e.key === 'Escape') {
                    // Let Flatpickr handle closing its own calendar dropdown first if open
                    if ($('.flatpickr-calendar.open').length > 0) {
                        return;
                    }

                    if ($('#documentPreviewModal').hasClass('is-active')) {
                        closeDocPreviewModal();
                        return;
                    }

                    if ($('#deleteBlackoutModal').hasClass('is-active')) {
                        $('#deleteBlackoutModal').removeClass('is-active');
                        openModal('#blackoutModal');
                        return;
                    }

                    if ($('#blackoutModal').hasClass('is-active')) {
                        if (isBlackoutFormDirty()) {
                            pulseModalCard('#blackoutModal');
                            return;
                        }
                        $('#blackoutModal').removeClass('is-active');
                        return;
                    }

                    if ($('#rescheduleModal').hasClass('is-active')) {
                        if (isRescheduleFormDirty()) {
                            pulseModalCard('#rescheduleModal');
                            return;
                        }
                        $('#rescheduleModal').removeClass('is-active');
                        return;
                    }

                    if ($('#quoteModal').hasClass('is-active')) {
                        if (isQuoteFormDirty()) {
                            pulseModalCard('#quoteModal');
                            return;
                        }
                        $('#quoteModal').removeClass('is-active');
                        return;
                    }
                }
            });

});
