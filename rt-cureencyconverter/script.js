        // Configuration - You should replace these with your own values
        const API_KEY = '7008384b3957f72f4092b396'; // Replace with your actual API key
        const DEFAULT_BASE_CURRENCY = 'USD';
        const DEFAULT_TARGET_CURRENCY = 'EUR';
        const API_URL = `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/`;
        
        // Cache configuration
        const CACHE_EXPIRY_HOURS = 24; // Rates are updated daily
        const CACHE_KEY = 'currencyConverterData';

        // Get DOM elements
        const fromCurrencySelect = document.getElementById('fromCurrency');
        const toCurrencySelect = document.getElementById('toCurrency');
        const amountInput = document.getElementById('amount');
        const resultDisplay = document.getElementById('resultContent');
        const resultContainer = document.getElementById('result');
        const statusMessage = document.getElementById('statusMessage');
        const convertButton = document.getElementById('convertButton');
        const swapButton = document.getElementById('swapButton');
        const rateInfo = document.getElementById('rateInfo');
        const lastUpdated = document.getElementById('lastUpdated');

        let exchangeRates = {};
        let lastFetchTime = null;
        let baseCurrency = DEFAULT_BASE_CURRENCY;

        // --- Utility Functions ---

        // Format numbers with commas and 2 decimal places
        function formatNumber(num) {
            return num.toLocaleString(undefined, { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
        }

        // Get cached data from localStorage
        function getCachedData() {
            const cachedData = localStorage.getItem(CACHE_KEY);
            if (!cachedData) return null;
            
            try {
                const parsedData = JSON.parse(cachedData);
                const cacheAgeHours = (Date.now() - parsedData.timestamp) / (1000 * 60 * 60);
                
                if (cacheAgeHours < CACHE_EXPIRY_HOURS) {
                    return parsedData;
                }
            } catch (e) {
                console.error("Error parsing cached data:", e);
            }
            
            return null;
        }

        // Save data to cache
        function saveToCache(data) {
            const cacheData = {
                rates: data.conversion_rates,
                base: data.base_code,
                timestamp: Date.now(),
                time_last_update_utc: data.time_last_update_utc
            };
            
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        }

        // Update the last updated display
        function updateLastUpdated(timeString) {
            if (timeString) {
                lastUpdated.textContent = `Last updated: ${timeString}`;
            } else {
                lastUpdated.textContent = '';
            }
        }

        // --- Core Functions ---

        // Fetches exchange rates from API or cache
        async function fetchExchangeRates() {
            // Check cache first
            const cachedData = getCachedData();
            if (cachedData) {
                exchangeRates = cachedData.rates;
                baseCurrency = cachedData.base;
                populateCurrencySelectors(exchangeRates);
                updateLastUpdated(cachedData.time_last_update_utc);
                setStatus('success', 'Using cached rates (updated daily)');
                convertButton.disabled = false;
                convertCurrency();
                return;
            }

            // No valid cache, fetch from API
            setStatus('loading', 'Fetching latest exchange rates...');
            convertButton.disabled = true;

            try {
                const response = await fetch(`${API_URL}${DEFAULT_BASE_CURRENCY}`);
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`API error: ${errorData.error_type || 'Unknown error'}`);
                }
                
                const data = await response.json();
                
                if (data.result === 'success') {
                    exchangeRates = data.conversion_rates;
                    baseCurrency = data.base_code;
                    populateCurrencySelectors(exchangeRates);
                    saveToCache(data);
                    updateLastUpdated(data.time_last_update_utc);
                    setStatus('success', 'Rates loaded successfully');
                    convertButton.disabled = false;
                    convertCurrency();
                } else {
                    throw new Error(`API reported failure: ${data['error-type'] || 'Unknown error'}`);
                }
            } catch (error) {
                console.error("Error fetching currencies:", error);
                setStatus('error', `Failed to load rates: ${error.message}`);
                resultContainer.classList.add('error');
                resultDisplay.textContent = "Could not fetch rates. Try again later.";
                convertButton.disabled = true;
            }
        }

        // Set status message with icon and style
        function setStatus(type, message) {
            statusMessage.className = 'status-message ' + type;
            
            let icon;
            switch (type) {
                case 'loading':
                    icon = '<i class="fas fa-spinner spin"></i>';
                    break;
                case 'error':
                    icon = '<i class="fas fa-exclamation-circle"></i>';
                    break;
                case 'success':
                    icon = '<i class="fas fa-check-circle"></i>';
                    break;
                case 'warning':
                    icon = '<i class="fas fa-exclamation-triangle"></i>';
                    break;
                default:
                    icon = '';
            }
            
            statusMessage.innerHTML = `${icon} ${message}`;
        }

        // Populate currency dropdowns
        function populateCurrencySelectors(rates) {
            fromCurrencySelect.innerHTML = '';
            toCurrencySelect.innerHTML = '';

            const currencyCodes = Object.keys(rates).sort();

            currencyCodes.forEach(code => {
                const optionFrom = document.createElement('option');
                optionFrom.value = code;
                optionFrom.textContent = `${code}`;
                if (code === DEFAULT_BASE_CURRENCY) optionFrom.selected = true;
                fromCurrencySelect.appendChild(optionFrom);

                const optionTo = document.createElement('option');
                optionTo.value = code;
                optionTo.textContent = `${code}`;
                if (code === DEFAULT_TARGET_CURRENCY) optionTo.selected = true;
                toCurrencySelect.appendChild(optionTo);
            });
        }

        // Perform currency conversion
        function convertCurrency() {
            const amount = parseFloat(amountInput.value);
            const fromCurrency = fromCurrencySelect.value;
            const toCurrency = toCurrencySelect.value;

            resultContainer.classList.remove('error', 'success');

            // Validate input
            if (isNaN(amount) || amount <= 0) {
                resultContainer.classList.add('error');
                resultDisplay.textContent = `Please enter a valid positive amount`;
                rateInfo.textContent = '';
                return;
            }

            if (Object.keys(exchangeRates).length === 0) {
                resultContainer.classList.add('error');
                resultDisplay.textContent = `Currency rates not loaded`;
                rateInfo.textContent = '';
                return;
            }

            const rateFrom = exchangeRates[fromCurrency];
            const rateTo = exchangeRates[toCurrency];

            if (!rateFrom || !rateTo) {
                resultContainer.classList.add('error');
                resultDisplay.textContent = `Exchange rate data missing`;
                rateInfo.textContent = '';
                return;
            }

            // Conversion logic: (Amount / Rate of 'from' currency) * Rate of 'to' currency
            const convertedAmount = (amount / rateFrom) * rateTo;
            const rate = (1 / rateFrom) * rateTo;

            // Format numbers
            const formattedAmount = formatNumber(amount);
            const formattedConvertedAmount = formatNumber(convertedAmount);
            const formattedRate = formatNumber(rate);

            // Display results
            resultContainer.classList.add('success');
            resultDisplay.innerHTML = `<strong>${formattedAmount} ${fromCurrency}</strong> = <strong>${formattedConvertedAmount} ${toCurrency}</strong>`;
            rateInfo.textContent = `1 ${fromCurrency} = ${formattedRate} ${toCurrency}`;
        }

        // Swap from and to currencies
        function swapCurrencies() {
            const temp = fromCurrencySelect.value;
            fromCurrencySelect.value = toCurrencySelect.value;
            toCurrencySelect.value = temp;
            convertCurrency();
        }

        // --- Event Listeners ---
        amountInput.addEventListener('input', convertCurrency);
        fromCurrencySelect.addEventListener('change', convertCurrency);
        toCurrencySelect.addEventListener('change', convertCurrency);
        convertButton.addEventListener('click', convertCurrency);
        swapButton.addEventListener('click', swapCurrencies);

        // Allow only numbers and decimal point in amount input
        amountInput.addEventListener('keypress', (e) => {
            if (e.key === '-' || (e.key === '.' && amountInput.value.includes('.'))) {
                e.preventDefault();
            }
        });

        // --- Initialization ---
        document.addEventListener('DOMContentLoaded', fetchExchangeRates);

        // Service worker registration for PWA capabilities
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(registration => {
                    console.log('ServiceWorker registration successful');
                }).catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
            });
        }
