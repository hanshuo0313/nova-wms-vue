
<template>
  <div class="app-container">
    <el-card>
      <el-form :model="queryParams" ref="queryRef" :inline="true" label-width="68px">
        <el-form-item label="仓库" prop="warehouseId">
          <el-select style="width: 100%" v-model="queryParams.warehouseId" placeholder="请选择仓库"
                     filterable clearable>
            <el-option v-for="item in useWmsStore().warehouseList" :key="item.id" :label="item.warehouseName"
                       :value="item.id"/>
          </el-select>
        </el-form-item>
        <el-form-item label="库位编号" prop="stockCode">
          <el-input
            v-model="queryParams.stockCode"
            placeholder="请输入库位编号"
            clearable
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="库位状态" prop="status">
          <el-select v-model="queryParams.status" placeholder="请选择库位状态" clearable style="width: 100%">
            <el-option
              v-for="dict in wms_location_status"
              :key="dict.value"
              :label="dict.label"
              :value="dict.value"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="mt20">

      <el-row :gutter="10" class="mb8" type="flex" justify="space-between">
        <el-col :span="6"><span style="font-size: large">库位管理</span></el-col>
        <el-col :span="1.5">
          <el-button
            type="primary"
            plain
            icon="Plus"
            @click="handleAdd"
            v-hasPermi="['wms:location:add']"
          >新增</el-button>
          <el-button
            type="success"
            plain
            icon="Plus"
            @click="handleBatchAdd"
            v-hasPermi="['wms:location:add']"
          >批量新增</el-button>
          <el-button
            type="warning"
            plain
            icon="Download"
            @click="handleExport"
            v-hasPermi="['wms:location:export']"
          >导出</el-button>
          <el-button
            type="info"
            plain
            icon="Download"
            @click="handleBatchDownload"
            :disabled="ids.length === 0"
            v-hasPermi="['wms:location:edit']"
          >批量下载码</el-button>
        </el-col>
      </el-row>

      <el-table v-loading="loading" :data="locationList" border class="mt20" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="序号" type="index" width="60" align="center" />
        <el-table-column label="所属仓库" prop="warehouseId">
          <template #default="scope">
            {{ getWarehouseName(scope.row.warehouseId) }}
          </template>
        </el-table-column>
        <el-table-column label="库位编号" prop="stockCode" />
        <el-table-column label="库位状态" prop="status">
          <template #default="scope">
            <dict-tag :options="wms_location_status" :value="scope.row.status"/>
          </template>
        </el-table-column>
        <el-table-column label="操作" align="right" class-name="small-padding fixed-width" width="180">
          <template #default="scope">
            <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['wms:location:edit']">修改</el-button>
            <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['wms:location:remove']">删除</el-button>
          </template>
        </el-table-column>
      </el-table>



      <el-row>
        <pagination
          v-show="total>0"
          :total="total"
          v-model:page="queryParams.pageNum"
          v-model:limit="queryParams.pageSize"
          @pagination="getList"
        />
      </el-row>

    </el-card>
    <!-- 添加或修改库位管理对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="locationRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="仓库" prop="warehouseId">
          <el-select style="width: 100%" v-model="form.warehouseId" placeholder="请选择仓库"
                     filterable clearable>
            <el-option v-for="item in useWmsStore().warehouseList" :key="item.id" :label="item.warehouseName"
                       :value="item.id"/>
          </el-select>
        </el-form-item>
        <el-form-item label="库位编号" prop="stockCode">
          <el-input v-model="form.stockCode" placeholder="请输入库位编号" />
        </el-form-item>
        <el-form-item label="库位状态" prop="status">
          <el-select v-model="form.status" placeholder="请选择库位状态" style="width: 100%">
            <el-option
              v-for="dict in wms_location_status"
              :key="dict.value"
              :label="dict.label"
              :value="dict.value"
            ></el-option>
          </el-select>
        </el-form-item>

      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button :loading="buttonLoading" type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 批量新增对话框 -->
    <el-dialog
      title="批量新增库位"
      v-model="batchAddDialog.visible"
      width="600px"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form :model="batchAddDialog" label-width="100px">
        <el-form-item label="仓库">
          <el-select style="width: 100%" v-model="batchAddDialog.warehouseId" placeholder="请选择仓库"
                     filterable clearable>
            <el-option v-for="item in useWmsStore().warehouseList" :key="item.id" :label="item.warehouseName"
                       :value="item.id"/>
          </el-select>
        </el-form-item>
        <el-form-item label="编号格式">
          <el-radio-group v-model="batchAddDialog.formatType">
            <el-radio label="custom">自定义格式</el-radio>
            <el-radio label="range">范围生成</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 自定义格式 -->
        <div v-if="batchAddDialog.formatType === 'custom'">
          <el-form-item label="编号前缀">
            <el-input v-model="batchAddDialog.prefix" placeholder="例如：S17-" />
          </el-form-item>
          <el-form-item label="第一段">
            <el-row :gutter="10">
              <el-col :span="8">
                <el-input-number v-model="batchAddDialog.segment1Start" :min="1" :max="99" controls-position="right" placeholder="起始" style="width: 100%" />
              </el-col>
              <el-col :span="8">
                <span style="line-height: 32px">至</span>
              </el-col>
              <el-col :span="8">
                <el-input-number v-model="batchAddDialog.segment1End" :min="1" :max="99" controls-position="right" placeholder="结束" style="width: 100%" />
              </el-col>
            </el-row>
          </el-form-item>
          <el-form-item label="第二段">
            <el-row :gutter="10">
              <el-col :span="8">
                <el-input-number v-model="batchAddDialog.segment2Start" :min="1" :max="99" controls-position="right" placeholder="起始" style="width: 100%" />
              </el-col>
              <el-col :span="8">
                <span style="line-height: 32px">至</span>
              </el-col>
              <el-col :span="8">
                <el-input-number v-model="batchAddDialog.segment2End" :min="1" :max="99" controls-position="right" placeholder="结束" style="width: 100%" />
              </el-col>
            </el-row>
          </el-form-item>
          <el-form-item label="分隔符">
            <el-select v-model="batchAddDialog.separator" placeholder="请选择分隔符" style="width: 100%">
              <el-option label="- (横杠)" value="-" />
              <el-option label="_ (下划线)" value="_" />
              <el-option label=". (点)" value="." />
              <el-option label="无" value="" />
            </el-select>
          </el-form-item>
          <el-form-item label="数字位数">
            <el-input-number v-model="batchAddDialog.digitLength" :min="1" :max="4" controls-position="right" />
            <span style="margin-left: 10px; color: #909399; font-size: 12px;">不足位数补0</span>
          </el-form-item>
          <el-alert
            :title="`将生成 ${calculateCount()} 个库位，示例：${generatePreview()}`"
            type="info"
            :closable="false"
            show-icon            style="margin-top: 10px"
          />
        </div>

        <!-- 范围生成 -->
        <div v-if="batchAddDialog.formatType === 'range'">
          <el-form-item label="起始编号">
            <el-input v-model="batchAddDialog.startCode" placeholder="例如：S17-01-01" />
          </el-form-item>
          <el-form-item label="结束编号">
            <el-input v-model="batchAddDialog.endCode" placeholder="例如：S17-03-04" />
          </el-form-item>
          <el-alert
            title="系统将根据起始和结束编号自动生成中间的所有编号"
            type="warning"
            :closable="false"
            show-icon            style="margin-top: 10px"
          />
        </div>

        <el-form-item label="库位状态" style="margin-top: 15px">
          <el-select v-model="batchAddDialog.status" placeholder="请选择库位状态" style="width: 100%">
            <el-option
              v-for="dict in wms_location_status"
              :key="dict.value"
              :label="dict.label"
              :value="dict.value"
            ></el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button :loading="batchAddDialog.loading" type="primary" @click="confirmBatchAdd">确 定</el-button>
          <el-button @click="batchAddDialog.visible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 批量下载对话框 -->
    <el-dialog
      title="批量下载库位码"
      v-model="batchDownloadDialog.visible"
      width="500px"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form label-width="100px">
        <el-form-item label="已选库位数">
          <el-input :value="batchDownloadDialog.selectedCount" disabled />
        </el-form-item>
        <el-form-item label="下载类型">
          <el-radio-group v-model="batchDownloadDialog.type">
            <el-radio label="barcode">条码</el-radio>
            <el-radio label="qrcode">二维码</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-alert
          :title="`将为 ${batchDownloadDialog.selectedCount} 个库位生成${batchDownloadDialog.type === 'barcode' ? '条码' : '二维码'}`"
          type="info"
          :closable="false"
          show-icon
        />
        <div style="margin-top: 10px; color: #909399; font-size: 12px;">
          生成的文件将打包成ZIP格式下载，每个图片以库位编号命名
        </div>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button :loading="batchDownloadDialog.loading" type="primary" @click="confirmBatchDownload">确 定</el-button>
          <el-button @click="batchDownloadDialog.visible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Location">import { listLocation, getLocation, delLocation, addLocation, updateLocation } from "@/api/wms/location";
import {useWmsStore} from '@/store/modules/wms'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import Qrcode from 'qrcode'
import JSBarcode from 'jsbarcode'
import * as XLSX from 'xlsx'

const { proxy } = getCurrentInstance();
const { wms_location_status } = proxy.useDict("wms_location_status");

const locationList = ref([]);
const open = ref(false);
const buttonLoading = ref(false);
const loading = ref(true);
const ids = ref([]);
const total = ref(0);
const title = ref("");

// ... existing code ...

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    warehouseId: undefined,
    stockCode: undefined,
    status: undefined,
  },
  rules: {
    id: [
      { required: true, message: "不能为空", trigger: "blur" }
    ],
    warehouseId: [
      { required: true, message: "所属仓库不能为空", trigger: "blur" }
    ],
    stockCode: [
      { required: true, message: "库位编号不能为空", trigger: "blur" }
    ],
    status: [
      { required: true, message: "库位状态不能为空", trigger: "change" }
    ],
  }
});

const { queryParams, form, rules } = toRefs(data);

// 批量新增对话框
const batchAddDialog = reactive({
  visible: false,
  loading: false,
  warehouseId: undefined,
  formatType: 'custom', // 'custom' or 'range'
  // 自定义格式
  prefix: 'S17-',
  segment1Start: 1,
  segment1End: 3,
  segment2Start: 1,
  segment2End: 4,
  separator: '-',
  digitLength: 2,
  // 范围生成
  startCode: '',
  endCode: '',
  // 通用
  status: '1'
})

// 批量下载对话框
const batchDownloadDialog = reactive({
  visible: false,
  type: 'barcode', // 'barcode' or 'qrcode'
  selectedCount: 0,
  loading: false,
  selectedLocations: []
})

/** 查询库位管理列表 */
function getList() {
  loading.value = true;
  listLocation(queryParams.value).then(response => {
    locationList.value = response.rows;
    total.value = response.total;
    loading.value = false;
  });
}

// 取消按钮
function cancel() {
  open.value = false;
  reset();
}
// 表单重置
function reset() {
  form.value = {
    id: null,
    warehouseId: null,
    stockCode: null,
    status: "1",
    createBy: null,
    createTime: null,
    updateBy: null,
    updateTime: null
  };
  proxy.resetForm("locationRef");
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
  proxy.resetForm("queryRef");
  handleQuery();
}

/** 多选框选中数据 */
function handleSelectionChange(selection) {
  ids.value = selection.map(item => item.id);
  batchDownloadDialog.selectedLocations = selection;
  batchDownloadDialog.selectedCount = selection.length;
}

/** 新增按钮操作 */
function handleAdd() {
  reset();
  open.value = true;
  title.value = "添加库位管理";
}

/** 批量新增按钮操作 */
function handleBatchAdd() {
  batchAddDialog.visible = true;
  batchAddDialog.warehouseId = queryParams.value.warehouseId || undefined;
}

/** 计算生成的库位数量 */
function calculateCount() {
  if (batchAddDialog.formatType !== 'custom') return 0;
  const count1 = batchAddDialog.segment1End - batchAddDialog.segment1Start + 1;
  const count2 = batchAddDialog.segment2End - batchAddDialog.segment2Start + 1;
  return count1 * count2;
}

/** 生成预览示例 */
function generatePreview() {
  if (batchAddDialog.formatType !== 'custom') return '';
  const seg1 = String(batchAddDialog.segment1Start).padStart(batchAddDialog.digitLength, '0');
  const seg2 = String(batchAddDialog.segment2Start).padStart(batchAddDialog.digitLength, '0');
  const sep = batchAddDialog.separator;
  return `${batchAddDialog.prefix}${seg1}${sep}${seg2}`;
}

/** 解析库位编号 */
function parseLocationCode(code) {
  // 尝试匹配格式：前缀 + 数字 + 分隔符 + 数字 + 分隔符 + 数字
  const match = code.match(/^([A-Za-z]+)(\d+)([-_.])(\d+)([-_.])(\d+)$/);
  if (!match) return null;

  return {
    prefix: match[1],
    segment1: parseInt(match[2]),
    separator1: match[3],
    segment2: parseInt(match[4]),
    separator2: match[5],
    segment3: parseInt(match[6]),
    // 保存原始字符串以保留位数信息
    segment1Raw: match[2],
    segment2Raw: match[4],
    segment3Raw: match[6]
  };
}

/** 生成库位编号列表 */
function generateLocationCodes() {
  const codes = [];

  if (batchAddDialog.formatType === 'custom') {
    // 自定义格式生成
    for (let i = batchAddDialog.segment1Start; i <= batchAddDialog.segment1End; i++) {
      for (let j = batchAddDialog.segment2Start; j <= batchAddDialog.segment2End; j++) {
        const seg1 = String(i).padStart(batchAddDialog.digitLength, '0');
        const seg2 = String(j).padStart(batchAddDialog.digitLength, '0');
        const code = `${batchAddDialog.prefix}${seg1}${batchAddDialog.separator}${seg2}`;
        codes.push(code);
      }
    }
  } else if (batchAddDialog.formatType === 'range') {
    // 范围生成
    const startParsed = parseLocationCode(batchAddDialog.startCode);
    const endParsed = parseLocationCode(batchAddDialog.endCode);

    if (!startParsed || !endParsed) {
      proxy.$modal.msgError('编号格式不正确，请使用类似 S17-01-01 的格式');
      return [];
    }

    if (startParsed.prefix !== endParsed.prefix) {
      proxy.$modal.msgError('起始和结束编号的前缀必须一致');
      return [];
    }

    // 使用原始字符串的长度来确定位数
    const len1 = startParsed.segment1Raw.length;
    const len2 = startParsed.segment2Raw.length;
    const len3 = startParsed.segment3Raw.length;

    for (let i = startParsed.segment1; i <= endParsed.segment1; i++) {
      for (let j = startParsed.segment2; j <= endParsed.segment2; j++) {
        for (let k = startParsed.segment3; k <= endParsed.segment3; k++) {
          const seg1 = String(i).padStart(len1, '0');
          const seg2 = String(j).padStart(len2, '0');
          const seg3 = String(k).padStart(len3, '0');
          const code = `${startParsed.prefix}${seg1}${startParsed.separator1}${seg2}${startParsed.separator2}${seg3}`;
          codes.push(code);
        }
      }
    }
  }

  return codes;
}

/** 确认批量新增 */
async function confirmBatchAdd() {
  if (!batchAddDialog.warehouseId) {
    proxy.$modal.msgError('请选择仓库');
    return;
  }

  const codes = generateLocationCodes();
  if (codes.length === 0) {
    proxy.$modal.msgError('未生成任何库位编号，请检查输入');
    return;
  }

  if (codes.length > 1000) {
    proxy.$modal.msgWarning(`将生成 ${codes.length} 个库位，数量较多，请确认是否继续`);
    return;
  }

  try {
    await proxy.$modal.confirm(`确认创建 ${codes.length} 个库位吗？`);
  } catch {
    return;
  }

  batchAddDialog.loading = true;

  try {
    let successCount = 0;
    let failCount = 0;

    for (const code of codes) {
      try {
        await addLocation({
          warehouseId: batchAddDialog.warehouseId,
          stockCode: code,
          status: batchAddDialog.status
        });
        successCount++;
      } catch (error) {
        console.error(`创建库位 ${code} 失败:`, error);
        failCount++;
      }
    }

    if (failCount === 0) {
      proxy.$modal.msgSuccess(`成功创建 ${successCount} 个库位`);
    } else {
      proxy.$modal.msgWarning(`成功 ${successCount} 个，失败 ${failCount} 个`);
    }

    batchAddDialog.visible = false;
    getList();
  } catch (error) {
    console.error('批量新增失败:', error);
    proxy.$modal.msgError('批量新增失败，请重试');
  } finally {
    batchAddDialog.loading = false;
  }
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const _id = row.id || ids.value
  getLocation(_id).then(response => {
    form.value = response.data;
    // 将 status 转换为字符串，确保与字典 value 类型一致
    if (form.value.status !== null && form.value.status !== undefined) {
      form.value.status = String(form.value.status);
    }
    open.value = true;
    title.value = "修改库位管理";
  });
}


/** 提交按钮 */
function submitForm() {
  proxy.$refs["locationRef"].validate(valid => {
    if (valid) {
      buttonLoading.value = true;
      if (form.value.id != null) {
        updateLocation(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        }).finally(() => {
          buttonLoading.value = false;
        });
      } else {
        addLocation(form.value).then(response => {
          proxy.$modal.msgSuccess("新增成功");
          open.value = false;
          getList();
        }).finally(() => {
          buttonLoading.value = false;
        });
      }
    }
  });
}

/** 删除按钮操作 */
function handleDelete(row) {
  const _ids = row.id || ids.value;
  proxy.$modal.confirm('是否确认删除库位管理编号为"' + _ids + '"的数据项？').then(function() {
    loading.value = true;
    return delLocation(_ids);
  }).then(() => {
    loading.value = true;
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => {
  }).finally(() => {
    loading.value = false;
  });
}

/** 导出按钮操作 */
function handleExport() {
  loading.value = true;
  listLocation({
    ...queryParams.value,
    pageNum: 1,
    pageSize: 99999
  }).then(response => {
    const data = response.rows || [];

    // 转换数据格式
    const exportData = data.map((item, index) => ({
      '序号': index + 1,
      '所属仓库': getWarehouseName(item.warehouseId),
      '库位编号': item.stockCode,
      '库位状态': getStatusText(item.status)
    }));

    // 创建工作簿和工作表
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'location');

    // 生成Excel文件并下载
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `location_${new Date().getTime()}.xlsx`);

    loading.value = false;
    proxy.$modal.msgSuccess('导出成功');
  }).catch(() => {
    loading.value = false;
    proxy.$modal.msgError('导出失败');
  });
}

// 获取状态文本
function getStatusText(status) {
  if (!status && status !== 0) return '-';
  const statusDict = wms_location_status.value?.find(dict => dict.value === String(status));
  return statusDict ? statusDict.label : String(status);
}

/** 批量下载按钮操作 */
function handleBatchDownload() {
  if (ids.value.length === 0) {
    proxy.$modal.msgWarning('请先选择要下载的库位');
    return;
  }
  batchDownloadDialog.visible = true;
}

/** 确认批量下载 */
async function confirmBatchDownload() {
  if (batchDownloadDialog.selectedLocations.length === 0) {
    proxy.$modal.msgError('没有选中的库位');
    return;
  }

  batchDownloadDialog.loading = true;

  try {
    const zip = new JSZip();
    const locations = batchDownloadDialog.selectedLocations;

    for (let i = 0; i < locations.length; i++) {
      const location = locations[i];
      const codeValue = location.stockCode;

      let blob;
      if (batchDownloadDialog.type === 'barcode') {
        blob = await generateBarcodeBlob(codeValue);
      } else {
        blob = await generateQrcodeBlob(codeValue);
      }

      const fileName = `${codeValue}.png`;
      zip.file(fileName, blob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const zipFileName = `库位${batchDownloadDialog.type === 'barcode' ? '条码' : '二维码'}_${new Date().getTime()}.zip`;
    saveAs(content, zipFileName);

    proxy.$modal.msgSuccess(`成功生成 ${locations.length} 个${batchDownloadDialog.type === 'barcode' ? '条码' : '二维码'}`);
    batchDownloadDialog.visible = false;
  } catch (error) {
    console.error('生成失败:', error);
    proxy.$modal.msgError('生成失败，请重试');
  } finally {
    batchDownloadDialog.loading = false;
  }
}

// 生成单个条码的 Blob
function generateBarcodeBlob(codeValue) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      JSBarcode(canvas, codeValue, {
        format: "CODE128",
        displayValue: true,
        fontSize: 16,
        height: 100,
        margin: 10,
        background: "#ffffff",
        lineColor: "#000000"
      });

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('生成条码失败'));
        }
      }, 'image/png');
    } catch (error) {
      reject(error);
    }
  });
}

// 生成单个二维码的 Blob
function generateQrcodeBlob(codeValue) {
  return new Promise(async (resolve, reject) => {
    try {
      const qrCodeUrl = await Qrcode.toDataURL(codeValue, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 300,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      resolve(blob);
    } catch (error) {
      reject(error);
    }
  });
}

// 获取仓库名称
function getWarehouseName(warehouseId) {
  if (!warehouseId) return '-'
  const warehouse = useWmsStore().warehouseList.find(item => item.id === warehouseId)
  return warehouse ? warehouse.warehouseName : '-'
}

getList();
</script>
