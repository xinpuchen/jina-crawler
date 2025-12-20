document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('url-input');
    const submitBtn = document.getElementById('submit-btn');
    const resultsBody = document.getElementById('results-body');
    
    // Tab切换功能
    const tabManual = document.getElementById('tab-manual');
    const tabExcel = document.getElementById('tab-excel');
    const contentManual = document.getElementById('content-manual');
    const contentExcel = document.getElementById('content-excel');
    const resultsSection = document.querySelector('.results-section');
    
    // 切换到手动粘贴Tab
    tabManual.addEventListener('click', () => {
        if (isProcessing) {
            alert('任务正在进行中，无法切换处理类型！');
            return;
        }
        
        // 移除所有Tab的active类
        tabManual.classList.remove('active');
        tabExcel.classList.remove('active');
        contentManual.classList.remove('active');
        contentExcel.classList.remove('active');
        
        // 为当前Tab添加active类
        tabManual.classList.add('active');
        contentManual.classList.add('active');
        
        // 显示获取结果区域
        resultsSection.style.display = 'block';
    });
    
    // 切换到Excel上传Tab
    tabExcel.addEventListener('click', () => {
        if (isProcessing) {
            alert('任务正在进行中，无法切换处理类型！');
            return;
        }
        
        // 移除所有Tab的active类
        tabManual.classList.remove('active');
        tabExcel.classList.remove('active');
        contentManual.classList.remove('active');
        contentExcel.classList.remove('active');
        
        // 为当前Tab添加active类
        tabExcel.classList.add('active');
        contentExcel.classList.add('active');
        
        // 隐藏获取结果区域（Excel上传形式不需要在页面显示结果）
        resultsSection.style.display = 'none';
    });
    
    // 页面加载时，根据当前激活的Tab显示或隐藏结果区域
    if (tabExcel.classList.contains('active')) {
        resultsSection.style.display = 'none';
    } else {
        resultsSection.style.display = 'block';
    }
    
    // Excel相关元素
    const excelFileInput = document.getElementById('excel-file');
    const processExcelBtn = document.getElementById('process-excel-btn');
    const fileSelector = document.getElementById('file-selector');
    const progressSection = document.getElementById('progress-section');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const statusText = document.getElementById('status-text');
    const processedCount = document.getElementById('processed-count');
    const totalCount = document.getElementById('total-count');
    const successCount = document.getElementById('success-count');
    const errorCount = document.getElementById('error-count');
    const logContent = document.getElementById('log-content');
    const downloadExcelBtn = document.getElementById('download-excel-btn');
    
    // 任务状态变量
    let isProcessing = false;
    
    // Excel处理变量
    let currentWorkbook = null;
    let currentSheet = null;
    let extractedLinks = [];
    let processingResults = [];
    let currentBatchSize = 20; // 每批处理20个请求
    
    // 处理提交按钮点击事件
    submitBtn.addEventListener('click', async () => {
        const inputUrls = urlInput.value.trim();
        if (!inputUrls) {
            alert('请输入至少一个网页链接');
            return;
        }

        // 分割链接并过滤空行
        const urls = inputUrls.split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0);

        // 检查链接数量限制
        if (urls.length > 5000) {
            alert('最多只能输入5000个链接');
            return;
        }

        // 检查链接格式
        const invalidUrls = urls.filter(url => !isValidUrl(url));
        if (invalidUrls.length > 0) {
            alert(`以下链接格式无效：\n${invalidUrls.join('\n')}`);
            return;
        }

        // 清空之前的结果
        resultsBody.innerHTML = '';
        
        // 更新结果表格标题（添加行号列）
        const tableHead = document.querySelector('#results-table thead tr');
        if (tableHead.children.length === 3) { // 如果还没有行号列
            const rowNumberTh = document.createElement('th');
            rowNumberTh.textContent = '行号';
            rowNumberTh.className = 'row-number-th';
            tableHead.insertBefore(rowNumberTh, tableHead.firstChild);
        }

        // 设置任务状态为处理中
        isProcessing = true;
        
        // 禁用提交按钮
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading"></span> 处理中...';

        try {
            // 并行处理所有链接（限制并发）
            const results = await batchProcessUrls(urls, currentBatchSize);

            // 显示结果
            results.forEach((result, index) => {
                addResultToTable(result, index + 1); // 显示行号（从1开始）
            });
            
            // 检查是否有错误
            const errorCount = results.filter(r => r.error).length;
            if (errorCount > 0) {
                alert(`处理完成！共 ${results.length} 个链接，其中 ${errorCount} 个处理失败。详情请查看进度日志。`);
            }
        } catch (error) {
            console.error('处理请求时出错:', error);
            alert('处理请求时出错，请稍后重试');
        } finally {
            // 恢复提交按钮
            submitBtn.disabled = false;
            submitBtn.innerHTML = '获取内容';
            
            // 设置任务状态为完成
            isProcessing = false;
        }
    });
    
    // 处理Excel文件选择事件
    excelFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            fileSelector.textContent = file.name;
            processExcelBtn.disabled = true; // 初始保持禁用状态，直到文件读取成功并提取到链接
            
            // 读取Excel文件
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    currentWorkbook = XLSX.read(data, { type: 'array' });
                    currentSheet = currentWorkbook.Sheets[currentWorkbook.SheetNames[0]];
                    
                    // 提取第E列的链接
                    extractedLinks = extractLinksFromExcel(currentSheet);
                    
                    if (extractedLinks.length === 0) {
                        alert('未在第E列找到有效链接');
                        processExcelBtn.disabled = true;
                        processExcelBtn.style.display = 'none';
                    } else {
                        logMessage(`成功提取 ${extractedLinks.length} 个链接（最多5000个）`);
                        processExcelBtn.disabled = false; // 只有在提取到有效链接后才启用按钮
                        processExcelBtn.style.display = 'inline-block'; // 显示处理按钮
                    }
                } catch (error) {
                    console.error('解析Excel文件出错:', error);
                    alert('解析Excel文件出错，请检查文件格式是否正确');
                    processExcelBtn.disabled = true;
                    processExcelBtn.style.display = 'none';
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            fileSelector.textContent = '选择Excel文件';
            processExcelBtn.disabled = true;
            processExcelBtn.style.display = 'none'; // 未选择文件时隐藏处理按钮
            currentWorkbook = null;
            currentSheet = null;
            extractedLinks = [];
        }
    });
    
    // 处理Excel文件按钮点击事件
    processExcelBtn.addEventListener('click', async () => {
        if (!currentWorkbook || !currentSheet || extractedLinks.length === 0) {
            alert('请先选择有效的Excel文件');
            return;
        }
        
        // 设置任务状态为处理中
        isProcessing = true;
        
        // 显示进度区域
        progressSection.style.display = 'block';
        resetProgress();
        
        // 更新总数
        totalCount.textContent = `总链接: ${extractedLinks.length}`;
        
        try {
            // 批量处理链接
            await batchProcessExcelLinks();
            
            // 将结果写入Excel
            writeResultsToExcel();
            
            // 显示下载按钮
            downloadExcelBtn.style.display = 'block';
            statusText.textContent = '处理完成！';
            logMessage('所有链接处理完成！');
            
            // 处理完成后隐藏进度条
            document.querySelector('.progress-container').style.display = 'none';
        } catch (error) {
            console.error('处理Excel文件出错:', error);
            statusText.textContent = '处理出错，请查看日志';
            logMessage(`处理出错: ${error.message}`);
            
            // 处理出错后也隐藏进度条
            document.querySelector('.progress-container').style.display = 'none';
        } finally {
            // 设置任务状态为完成
            isProcessing = false;
        }
    });
    
    // 处理Excel下载按钮点击事件
    downloadExcelBtn.addEventListener('click', () => {
        if (!currentWorkbook) {
            alert('没有可下载的处理结果');
            return;
        }
        
        const fileName = fileSelector.textContent.replace(/\.[^/.]+$/, '') + '_processed.xlsx';
        const wbout = XLSX.write(currentWorkbook, { bookType: 'xlsx', type: 'array' });
        
        // 创建下载链接
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    
    // 从Excel中提取第E列的链接
    function extractLinksFromExcel(sheet) {
        const links = [];
        const range = XLSX.utils.decode_range(sheet['!ref']);
        
        // 第E列的索引是4（从0开始）
        const targetColumn = 4;
        
        // 遍历第E列的所有行
        for (let row = range.s.r + 1; row <= range.e.r; row++) {
            const cellAddress = XLSX.utils.encode_cell({ c: targetColumn, r: row });
            const cell = sheet[cellAddress];
            
            if (cell && cell.v) {
                const url = String(cell.v).trim();
                if (isValidUrl(url)) {
                    links.push({
                        url: url,
                        row: row,
                        success: false
                    });
                }
            }
            
            // 限制最多5000个链接
            if (links.length >= 5000) {
                break;
            }
        }
        
        return links;
    }
    
    // 批量处理Excel链接
    async function batchProcessExcelLinks() {
        const totalLinks = extractedLinks.length;
        let processed = 0;
        let success = 0;
        let error = 0;
        const failedItems = [];
        
        // 分批次处理
        for (let i = 0; i < totalLinks; i += currentBatchSize) {
            const batch = extractedLinks.slice(i, i + currentBatchSize);
            const batchUrls = batch.map(item => item.url);
            
            statusText.textContent = `正在处理第 ${i + 1} 到 ${Math.min(i + currentBatchSize, totalLinks)} 个链接...`;
            logMessage(`开始处理第 ${i + 1} 到 ${Math.min(i + currentBatchSize, totalLinks)} 个链接`);
            
            try {
                const batchResults = await Promise.all(batchUrls.map(fetchUrlContent));
                
                // 更新结果
                batchResults.forEach((result, index) => {
                    const linkItem = batch[index];
                    linkItem.content = result.content;
                    linkItem.success = !result.error;
                    linkItem.errorMessage = result.errorMessage;
                    
                    if (linkItem.success) {
                        success++;
                    } else {
                        error++;
                        failedItems.push({
                            row: linkItem.row + 1, // 转换为人类可读的行号（从1开始）
                            url: linkItem.url,
                            errorMessage: result.errorMessage
                        });
                        // 记录详细错误信息
                        logErrorDetails(result.errorMessage, linkItem.row + 1, linkItem.url);
                    }
                    
                    processed++;
                    
                    // 更新进度
                    updateProgress(processed, totalLinks, success, error);
                });
                
                logMessage(`完成处理第 ${i + 1} 到 ${Math.min(i + currentBatchSize, totalLinks)} 个链接（成功: ${batchResults.filter(r => !r.error).length}, 失败: ${batchResults.filter(r => r.error).length}）`);
            } catch (err) {
                console.error('处理批次出错:', err);
                logMessage(`处理第 ${i + 1} 到 ${Math.min(i + currentBatchSize, totalLinks)} 个链接时出错: ${err.message}`);
                
                // 记录该批次所有链接为错误
                batch.forEach(linkItem => {
                    failedItems.push({
                        row: linkItem.row + 1,
                        url: linkItem.url,
                        errorMessage: err.message
                    });
                    logErrorDetails(err.message, linkItem.row + 1, linkItem.url);
                });
                
                error += batch.length;
                processed += batch.length;
                updateProgress(processed, totalLinks, success, error);
            }
            
            // 根据token是否存在设置不同的请求间隔时间
            const delayTime = getToken() ? 3000 : 60000; // token存在3秒，否则1分钟
            await new Promise(resolve => setTimeout(resolve, delayTime));
        }
        
        // 处理完成后显示错误汇总
        if (failedItems.length > 0) {
            logMessage(`\n===== 错误汇总 =====`, true);
            logMessage(`共 ${failedItems.length} 个链接处理失败`, true);
            failedItems.forEach(item => {
                logMessage(`第${item.row}行: ${item.errorMessage} (${item.url})`, true);
            });
            logMessage(`==================\n`, true);
        }
    }
    
    // 将结果写入Excel文件
    function writeResultsToExcel() {
        // 确定第G列后的列索引（第H列，索引7）
        const contentColumn = 7;
        const contentColumnLetter = XLSX.utils.encode_col(contentColumn);
        
        // 添加列标题
        const headerCellAddress = XLSX.utils.encode_cell({ c: contentColumn, r: 0 });
        currentSheet[headerCellAddress] = { v: '全文内容', t: 's' };
        
        // 写入结果
        extractedLinks.forEach(link => {
            const cellAddress = XLSX.utils.encode_cell({ c: contentColumn, r: link.row });
            
            // Excel单个单元格最大文本长度限制为32767字符，超过则截断
            let content = link.content || '';
            if (content.length > 32767) {
                content = content.substring(0, 32760) + '...(截断)';
            }
            
            // 使用类型为'l'的单元格存储长文本，这是SheetJS推荐的方式
            currentSheet[cellAddress] = { v: content, t: 'l' };
        });
        
        // 更新工作表范围
        const range = XLSX.utils.decode_range(currentSheet['!ref']);
        if (contentColumn > range.e.c) {
            range.e.c = contentColumn;
            currentSheet['!ref'] = XLSX.utils.encode_range(range);
        }
    }
    
    // 批量处理URL（用于普通文本输入）
    async function batchProcessUrls(urls) {
        const totalUrls = urls.length;
        const results = [];
        let processed = 0;
        let success = 0;
        let error = 0;
        
        // 显示进度区域
        progressSection.style.display = 'block';
        resetProgress();
        totalCount.textContent = `总链接: ${totalUrls}`;
        
        for (let i = 0; i < totalUrls; i += currentBatchSize) {
            const batch = urls.slice(i, i + currentBatchSize);
            const batchResults = await Promise.all(batch.map(fetchUrlContent));
            results.push(...batchResults);
            
            // 更新进度
            processed += batch.length;
            success += batchResults.filter(r => !r.error).length;
            error += batchResults.filter(r => r.error).length;
            updateProgress(processed, totalUrls, success, error);
            
            // 根据token是否存在设置不同的请求间隔时间
            if (i + currentBatchSize < totalUrls) {
                const delayTime = getToken() ? 3000 : 60000; // token存在3秒，否则1分钟
                await new Promise(resolve => setTimeout(resolve, delayTime));
            }
        }
        
        // 处理完成后隐藏进度区域
        progressSection.style.display = 'none';
        
        return results;
    }
    
    // 重置进度显示
    function resetProgress() {
        // 确保进度条显示
        document.querySelector('.progress-container').style.display = 'block';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        statusText.textContent = '准备开始处理...';
        processedCount.textContent = '已处理: 0';
        successCount.textContent = '成功: 0';
        errorCount.textContent = '失败: 0';
        logContent.innerHTML = '';
        downloadExcelBtn.style.display = 'none';
        processingResults = [];
    }
    
    // 更新进度显示
    function updateProgress(processed, total, success, error) {
        const percentage = Math.round((processed / total) * 100);
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}%`;
        processedCount.textContent = `已处理: ${processed}`;
        successCount.textContent = `成功: ${success}`;
        errorCount.textContent = `失败: ${error}`;
    }
    
    // 记录日志消息
    function logMessage(message, isError = false) {
        const timestamp = new Date().toLocaleTimeString();
        const logItem = document.createElement('div');
        logItem.className = isError ? 'log-error' : 'log-info';
        logItem.textContent = `[${timestamp}] ${message}`;
        logContent.appendChild(logItem);
        logContent.scrollTop = logContent.scrollHeight;
    }
    
    // 记录错误详情
    function logErrorDetails(message, rowNumber = null, url = null) {
        let errorMessage = message;
        if (rowNumber !== null) {
            errorMessage = `第${rowNumber}行: ${errorMessage}`;
        }
        if (url !== null) {
            errorMessage += ` (${url})`;
        }
        logMessage(errorMessage, true);
    }

    // 验证URL格式
    function isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch (error) {
            return false;
        }
    }

    // 调用API获取内容
    async function fetchUrlContent(originalUrl) {
        const apiUrl = `https://r.jina.ai/${originalUrl}`;
        const token = getToken();
        
        try {
            const headers = {
                'X-Md-Link-Style': 'discarded',
                'X-Remove-Selector': 'header, .header, #header, footer, .footer, #footer, nav, .nav, #nav, .navigation, #navigation, .menu, #menu, .nav-menu, #nav-menu, .top-nav, .main-nav, aside, .aside, #aside, .sidebar, #sidebar, .left-sidebar, .right-sidebar, .sidebar-left, .sidebar-right, .widget, .widget-area, .ad, #ad, .advertisement, #advertisement, .ads, #ads, .ad-container, .ad-wrapper, .banner, .banner-ad, .sponsored, .sponsored-content, .promo, .promotion, .advert, .advert-unit, .comments, #comments, .comment-section, .share-buttons, .social-share, .pagination, .nav-pagination, .related-posts, .related-articles, .tags, .post-tags, .author-bio, .author-info, .newsletter, .subscribe, .popup, .modal, .cookie-banner, .cookie-notice, .back-to-top, .scroll-top, .search, .search-form, .user-profile, .user-menu, .notification, .alert, .breadcrumb, .breadcrumbs',
                'X-Retain-Images': 'none'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch(apiUrl, {
                headers: headers
            });

            if (!response.ok) {
                // 提供更详细的错误信息
                let errorMessage = `HTTP错误! 状态: ${response.status}`;
                if (response.status === 404) {
                    errorMessage += ' (页面未找到)';
                } else if (response.status === 429) {
                    errorMessage += ' (请求过于频繁，请稍后重试)';
                } else if (response.status >= 500) {
                    errorMessage += ' (服务器错误)';
                }
                throw new Error(errorMessage);
            }

            // 尝试同时处理JSON和纯文本响应
            const contentType = response.headers.get('content-type');
            let content = '';
            
            if (contentType && contentType.includes('application/json')) {
                // 处理JSON响应
                const data = await response.json();
                if (data && data.content) {
                    content = data.content;
                } else if (data && data.message) {
                    content = `错误: ${data.message}`;
                } else {
                    content = '无法提取内容';
                }
            } else {
                // 处理纯文本响应
                content = await response.text();
            }

            // 提取标题
            let title = '无标题';
            if (content) {
                // 尝试从内容中提取标题
                const titleMatch = content.match(/^#\s+(.+)$/m);
                if (titleMatch) {
                    title = titleMatch[1];
                } else {
                    // 尝试从URL或其他方式获取标题
                    try {
                        const urlObj = new URL(originalUrl);
                        title = urlObj.hostname;
                    } catch (e) {
                        // 保留默认标题
                    }
                }
            }

            return {
                url: originalUrl,
                title: title,
                content: content || '无法提取内容',
                error: false,
                errorMessage: null
            };
        } catch (error) {
            console.error(`获取${originalUrl}内容时出错:`, error);
            return {
                url: originalUrl,
                title: '获取失败',
                content: `错误: ${error.message}`,
                error: true,
                errorMessage: error.message
            };
        }
    }

    // 将结果添加到表格（带行号）
    function addResultToTable(result, rowNumber = null) {
        const row = document.createElement('tr');
        
        // 行号列
        const rowNumberCell = document.createElement('td');
        rowNumberCell.textContent = rowNumber !== null ? rowNumber : '';
        rowNumberCell.className = 'row-number';
        row.appendChild(rowNumberCell);
        
        // 链接列
        const urlCell = document.createElement('td');
        const urlLink = document.createElement('a');
        urlLink.href = result.url;
        urlLink.textContent = result.url;
        urlLink.target = '_blank';
        urlLink.rel = 'noopener noreferrer';
        urlCell.appendChild(urlLink);
        row.appendChild(urlCell);

        // 标题列
        const titleCell = document.createElement('td');
        titleCell.textContent = result.title;
        if (result.error) {
            titleCell.classList.add('error');
        }
        row.appendChild(titleCell);

        // 内容列
        const contentCell = document.createElement('td');
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('content-cell');
        contentDiv.textContent = result.content;
        if (result.error) {
            contentDiv.classList.add('error-content');
        }
        
        // 创建复制按钮
        const copyBtn = document.createElement('button');
        copyBtn.classList.add('copy-btn');
        copyBtn.textContent = '复制';
        copyBtn.addEventListener('click', () => {
            copyToClipboard(result.content, copyBtn);
        });

        contentCell.appendChild(contentDiv);
        contentCell.appendChild(copyBtn);
        
        if (result.error) {
            contentCell.classList.add('error');
        }
        
        row.appendChild(contentCell);

        resultsBody.appendChild(row);
    }

    // 弹窗相关元素
    const settingsModal = document.getElementById('settings-modal');
    const settingsBtn = document.getElementById('settings-btn');
    const closeBtn = document.querySelector('.close');
    const cancelBtn = document.getElementById('close-settings-btn');
    const newTokenInput = document.getElementById('new-token-input');
    const addTokenBtn = document.getElementById('add-token-btn');
    const tokenListContainer = document.getElementById('token-list-container');
    
    // Token存储的键名
    const TOKEN_STORAGE_KEY = 'jina_crawler_tokens';
    
    // 获取所有tokens
    function getAllTokens() {
        const tokensStr = localStorage.getItem(TOKEN_STORAGE_KEY);
        return tokensStr ? JSON.parse(tokensStr) : [];
    }
    
    // 保存所有tokens
    function saveAllTokens(tokens) {
        localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    }
    
    // 获取当前激活的token
    function getActiveToken() {
        const tokens = getAllTokens();
        const activeToken = tokens.find(token => token.active);
        return activeToken ? activeToken.value : null;
    }
    
    // 设置激活的token
    function setActiveToken(tokenValue) {
        const tokens = getAllTokens();
        tokens.forEach(token => {
            token.active = token.value === tokenValue;
        });
        saveAllTokens(tokens);
    }
    
    // 添加新token
    function addToken(tokenValue) {
        if (!tokenValue) return false;
        
        const tokens = getAllTokens();
        
        // 检查是否已存在
        const existingToken = tokens.find(token => token.value === tokenValue);
        if (existingToken) {
            alert('该Token已存在！');
            return false;
        }
        
        // 如果这是第一个token，则设为激活状态
        const isActive = tokens.length === 0;
        
        tokens.push({
            value: tokenValue,
            active: isActive,
            createdAt: new Date().toISOString()
        });
        
        saveAllTokens(tokens);
        renderTokenList();
        return true;
    }
    
    // 删除token
    function removeToken(tokenValue) {
        let tokens = getAllTokens();
        
        // 检查是否是当前激活的token
        const activeToken = tokens.find(token => token.active);
        if (activeToken && activeToken.value === tokenValue) {
            // 如果是激活的token，询问用户是否确定删除
            if (tokens.length === 1) {
                // 如果是唯一的一个token，允许删除并清空激活状态
                tokens = tokens.filter(token => token.value !== tokenValue);
                saveAllTokens(tokens);
                renderTokenList();
                return true;
            } else {
                // 如果有多个token且当前token是激活的，不允许直接删除
                alert('此Token当前处于激活状态，无法直接删除。请先激活其他Token后再删除此Token！');
                return false;
            }
        }
        
        // 删除非激活的token
        tokens = tokens.filter(token => token.value !== tokenValue);
        
        saveAllTokens(tokens);
        renderTokenList();
        return true;
    }
    
    // 渲染token列表
    function renderTokenList() {
        const tokens = getAllTokens();
        tokenListContainer.innerHTML = '';
        
        if (tokens.length === 0) {
            tokenListContainer.innerHTML = '<p class="no-tokens">暂无Token，请添加</p>';
            return;
        }
        
        const ul = document.createElement('ul');
        ul.className = 'token-list';
        
        tokens.forEach(token => {
            const li = document.createElement('li');
            li.className = 'token-item';
            
            const tokenDisplay = document.createElement('div');
            tokenDisplay.className = 'token-display';
            tokenDisplay.textContent = token.value; // 显示完整token值
            
            const tokenActions = document.createElement('div');
            tokenActions.className = 'token-actions';
            
            // 启用/禁用按钮
            const activateBtn = document.createElement('button');
            activateBtn.className = token.active ? 'activate-btn active' : 'activate-btn';
            activateBtn.textContent = token.active ? '已启用' : '启用';
            activateBtn.title = token.active ? '已启用' : '启用';
            activateBtn.disabled = token.active;
            activateBtn.addEventListener('click', () => {
                setActiveToken(token.value);
                renderTokenList();
            });
            
            tokenActions.appendChild(activateBtn);
            
            // 显示删除按钮（非激活token总是可以删除；如果是唯一token即使激活也可以删除）
            if (!token.active || tokens.length === 1) {
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-btn';
                removeBtn.textContent = '删除';
                removeBtn.title = '删除';
                removeBtn.addEventListener('click', () => {
                    if (confirm('确定要删除此Token吗？')) {
                        removeToken(token.value);
                    }
                });
                tokenActions.appendChild(removeBtn);
            }
            
            li.appendChild(tokenDisplay);
            li.appendChild(tokenActions);
            
            if (token.active) {
                li.classList.add('active-token');
            }
            
            ul.appendChild(li);
        });
        
        tokenListContainer.appendChild(ul);
    }
    
    // 初始化设置弹窗
    function initSettings() {
        // 显示弹窗
        settingsBtn.addEventListener('click', () => {
            settingsModal.style.display = 'block';
            newTokenInput.value = '';
            renderTokenList();
        });
        
        // 关闭弹窗
        function closeModal() {
            settingsModal.style.display = 'none';
        }
        
        // 点击关闭按钮
        closeBtn.addEventListener('click', closeModal);
        
        // 点击取消按钮
        cancelBtn.addEventListener('click', closeModal);
        
        // 点击弹窗外部关闭
        window.addEventListener('click', (event) => {
            if (event.target === settingsModal) {
                closeModal();
            }
        });
        
        // 添加token
        addTokenBtn.addEventListener('click', () => {
            const tokenValue = newTokenInput.value.trim();
            if (tokenValue) {
                if (addToken(tokenValue)) {
                    newTokenInput.value = '';
                    // 移除了成功提示
                }
            } else {
                alert('请输入有效的Token！');
            }
        });
        
        // 回车添加token
        newTokenInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addTokenBtn.click();
            }
        });
        
        // 复制所有token按钮事件
        const copyAllTokensBtn = document.getElementById('copy-all-tokens-btn');
        if (copyAllTokensBtn) {
            copyAllTokensBtn.addEventListener('click', () => {
                const tokens = getAllTokens();
                if (tokens.length === 0) {
                    alert('没有Token可以复制！');
                    return;
                }
                
                // 将所有token值转换为字符串，每行一个
                const tokensText = tokens.map(token => token.value).join('\n');
                
                // 复制到剪贴板
                navigator.clipboard.writeText(tokensText).then(() => {
                    alert('Token列表已成功导出到剪贴板！');
                }).catch(err => {
                    console.error('复制失败:', err);
                    alert('复制失败，请手动复制以下内容：\n\n' + tokensText);
                });
            });
        }
        
        // 粘贴所有token按钮事件
        const pasteAllTokensBtn = document.getElementById('paste-all-tokens-btn');
        if (pasteAllTokensBtn) {
            pasteAllTokensBtn.addEventListener('click', () => {
                const pasteInput = prompt('请粘贴其他用户发给您的Token:');
                if (pasteInput === null) {
                    // 用户点击了取消
                    return;
                }
                
                const text = pasteInput.trim();
                if (!text) {
                    alert('输入为空或没有有效内容！');
                    return;
                }
                
                // 按行分割并过滤空行
                const tokenLines = text.split('\n').map(line => line.trim()).filter(line => line);
                
                if (tokenLines.length === 0) {
                    alert('输入中没有有效的Token！');
                    return;
                }
                
                // 获取现有tokens
                let existingTokens = getAllTokens();
                let addedCount = 0;
                
                // 添加每个token（去重）
                tokenLines.forEach(tokenValue => {
                    // 检查是否已存在
                    const existingToken = existingTokens.find(token => token.value === tokenValue);
                    if (!existingToken) {
                        // 添加新token
                        existingTokens.push({
                            value: tokenValue,
                            active: false, // 新粘贴的token默认不激活
                            createdAt: new Date().toISOString()
                        });
                        addedCount++;
                    }
                });
                
                // 保存更新后的tokens
                saveAllTokens(existingTokens);
                
                // 重新渲染列表
                renderTokenList();
                
                if (addedCount > 0) {
                    alert(`成功添加 ${addedCount} 个新Token！`);
                } else {
                    alert('没有添加新Token（所有Token均已存在）');
                }
            });
        }
        

        
        // 添加标签切换功能
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                // 移除所有导航项的active类
                navItems.forEach(navItem => navItem.classList.remove('active'));
                
                // 为当前点击的导航项添加active类
                item.classList.add('active');
                
                // 隐藏所有内容面板（仅限设置模态框内的面板）
                const settingsContent = document.querySelector('.settings-content');
                const tabContents = settingsContent.querySelectorAll('.tab-content');
                tabContents.forEach(content => content.classList.remove('active'));
                
                // 显示对应的内容面板
                const tabId = item.getAttribute('data-tab');
                document.getElementById(`${tabId}-tab`).classList.add('active');
            });
        });
    }
    
    // 修改原有的getToken函数以使用新的多token管理
    function getToken() {
        return getActiveToken();
    }
    
    // 调用初始化设置功能
    initSettings();

    // 复制内容到剪贴板
    async function copyToClipboard(text, button) {
        try {
            await navigator.clipboard.writeText(text);
            
            // 显示复制成功
            const originalText = button.textContent;
            button.textContent = '已复制';
            button.style.backgroundColor = '#2ecc71';
            
            // 恢复原状态
            setTimeout(() => {
                button.textContent = originalText;
                button.style.backgroundColor = '#27ae60';
            }, 2000);
        } catch (error) {
            console.error('复制失败:', error);
            
            // 显示复制失败
            const originalText = button.textContent;
            button.textContent = '复制失败';
            button.style.backgroundColor = '#e74c3c';
            
            // 恢复原状态
            setTimeout(() => {
                button.textContent = originalText;
                button.style.backgroundColor = '#27ae60';
            }, 2000);
        }
    }

    // 支持按Enter键提交（需要按住Shift键换行）
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitBtn.click();
        }
    });
});