<template>
  <div>
    <div class="receipt-order-edit-wrapper app-container" style="margin-bottom: 60px" v-loading="loading">
      <el-card header="出库单基本信息">
        <el-form label-width="108px" :model="form" ref="shipmentForm" :rules="rules">
          <el-row :gutter="24">
            <el-col :span="11">
              <el-form-item label="出库单号" prop="orderNo">
                <el-input class="w200" v-model="form.orderNo" placeholder="出库单号"
                          :disabled="form.id"></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="仓库" prop="warehouseId">
                <el-select v-model="form.warehouseId" placeholder="请选择仓库" @change="handleChangeWarehouse"
                           filterable>
                  <el-option v-for="item in useWmsStore().warehouseList" :key="item.id" :label="item.warehouseName"
                             :value="item.id"/>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="总数量" prop="totalQuantity">
                <el-input-number style="width: 100%" v-model="form.totalQuantity" :controls="false" :precision="0"
                                 :disabled="true"></el-input-number>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="24">
            <el-col :span="11">
              <el-form-item label="出库类型" prop="optType">
                <el-radio-group v-model="form.optType">
                  <el-radio-button
                    v-for="item in wms_shipment_type"
                    :key="item.value"
                    :label="item.value"
                  >{{ item.label }}
                  </el-radio-button
                  >
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="客户" prop="merchantId">
                <el-select v-model="form.merchantId" placeholder="请选择客户" clearable filterable>
                  <el-option v-for="item in useWmsStore().merchantList" :key="item.id" :label="item.merchantName"
                             :value="item.id"/>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="业务单号" prop="bizOrderNo">
                <el-input v-model="form.bizOrderNo" placeholder="请输入业务单号"></el-input>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="24">
            <el-col :span="11">
              <el-form-item label="备注" prop="remark">
                <el-input
                  v-model="form.remark"
                  placeholder="备注...100个字符以内"
                  rows="4"
                  maxlength="100"
                  type="textarea"
                  show-word-limit="show-word-limit"
                ></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <div style="display: flex;align-items: start">
                <el-form-item label="总金额" prop="totalAmount">
                  <el-input-number style="width: 100%;" v-model="form.totalAmount" :precision="2" :min="0"></el-input-number>
                </el-form-item>
                <el-button link type="primary" @click="handleAutoCalc" style="line-height: 32px">自动计算
                </el-button>
              </div>
            </el-col>
          </el-row>
        </el-form>
      </el-card>
      <el-card header="商品明细" class="mt10">
        <div class="receipt-order-content">
          <div class="flex-space-between mb8">
<!--            <div>
              <span>审批 | 一物一码：</span>
              <el-switch
                class="mr10 ml10"
                inline-prompt
                size="large"
                :active-value="true"
                :inactive-value="false"
                active-text="开启"
                inactive-text="关闭"
              />
            </div>-->
            <el-popover
              placement="left"
              title="提示"
              :width="200"
              trigger="hover"
              :disabled="!!form.warehouseId"
              content="请先选择仓库！"
            >
              <template #reference>
                <el-button type="primary" plain="plain" size="default" @click="showAddItem" icon="Plus"
                           :disabled="!form.warehouseId">添加商品
                </el-button>
              </template>
            </el-popover>
          </div>
          <el-table :data="form.details" border empty-text="暂无商品明细">
            <el-table-column label="商品名称" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.item.itemName }}
              </template>
            </el-table-column>
            <el-table-column label="商品编号" align="center" min-width="110" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.item.itemCode }}
              </template>
            </el-table-column>
            <el-table-column label="规格信息">
              <template #default="{ row }">
                <div>{{ row.itemSku.skuName }}</div>
                <div v-if="row.itemSku.skuCode">编码：{{row.itemSku.skuCode}}</div>
              </template>
            </el-table-column>
            <el-table-column label="库位编号" prop="stockCode" width="300">
              <template #default="scope">
                <div class="location-tags-wrapper">
                  <el-tag
                    v-for="(code, index) in parseLocationCodes(scope.row.stockCode)"
                    :key="index"
                    closable
                    type="info"
                    class="location-tag"
                    @close="handleRemoveLocation(scope.row, index)"
                  >
                    {{ code }}
                  </el-tag>
<!--                  <el-select
                    placeholder="添加库位"
                    size="small"                    style="width: 140px"
                    filterable
                    clearable
                    :loading="locationLoading"
                    v-model="scope.row._tempLocationSelect"
                    @change="handleAddLocation(scope.row, $event)"
                  >
                    <el-option
                      v-for="item in getLocationList(scope.row)"
                      :key="item"
                      :label="item"
                      :value="item"
                    />
                  </el-select>-->
                  <el-button
                    v-if="scope.row._originalStockCode && scope.row.stockCode !== scope.row._originalStockCode"
                    link
                    type="primary"
                    size="small"
                    @click="handleRestoreLocation(scope.row)"
                    class="restore-btn"
                  >
                    恢复
                  </el-button>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="出库数量" prop="quantity" width="180">
              <template #default="scope">
                <el-input-number
                  v-model="scope.row.quantity"
                  placeholder="出库数量"
                  :min="1"
                  :precision="0"
                  @change="handleChangeQuantity"
                ></el-input-number>
              </template>
            </el-table-column>
            <el-table-column label="金额" prop="amount" width="180">
              <template #default="scope">
                <el-input-number
                  v-model="scope.row.amount"
                  placeholder="金额"
                  :precision="2"
                  :min="0"
                  :max="2147483647"
                ></el-input-number>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" align="right" fixed="right">
              <template #default="scope">
                <el-button icon="Delete" type="danger" plain size="small"
                           @click="handleDeleteDetail(scope.row, scope.$index)" link>删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>
      <InventorySelect
        ref="inventorySelectRef"
        :model-value="inventorySelectShow"
        @handleOkClick="handleOkClick"
        @handleCancelClick="inventorySelectShow = false"
        :size="'75%'"
        :select-warehouse-disable="false"
        :warehouse-id="form.warehouseId"
        :selected-inventory="selectedInventory"
      />
    </div>
    <div class="footer-global">
      <div class="btn-box">
        <div>
          <el-button @click="doShipment" type="primary" class="ml10">完成出库</el-button>
          <el-button @click="updateToInvalid" type="danger" v-if="form.id">作废</el-button>
        </div>
        <div>
          <el-button @click="save" type="primary">暂存</el-button>
          <el-button @click="cancel" class="mr10">取消</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup name="ShipmentOrderEdit">
import {computed, getCurrentInstance, onMounted, reactive, ref, toRef, toRefs, watch} from "vue";
import {addShipmentOrder, getShipmentOrder, updateShipmentOrder, shipment} from "@/api/wms/shipmentOrder";
import {delShipmentOrderDetail} from "@/api/wms/shipmentOrderDetail";
import {ElMessage, ElMessageBox} from "element-plus";
import {useRoute} from "vue-router";
import {useWmsStore} from '@/store/modules/wms'
import {numSub, generateNo} from '@/utils/ruoyi'
import InventorySelect from "@/views/components/InventorySelect.vue";
import {getWarehouseAndSkuKey} from "@/utils/wmsUtil"
import {listLocation} from "@/api/wms/location";

const {proxy} = getCurrentInstance();
const {wms_shipment_type} = proxy.useDict("wms_shipment_type");

const loading = ref(false)
// 库位列表缓存（按仓库ID分组）
const locationListCache = ref({})
// 当前显示的库位列表
const currentLocationList = ref([])
// 库位加载状态
const locationLoading = ref(false)
const initFormData = {
  id: undefined,
  orderNo: undefined,
  optType: "2",
  merchantId: undefined,
  bizOrderNo: undefined,
  totalAmount: undefined,
  orderStatus: 0,
  remark: undefined,
  warehouseId: undefined,
  totalQuantity: 0,
  details: [],
}
const inventorySelectRef = ref(null)
const selectedInventory = ref([])
const data = reactive({
  form: {...initFormData},
  rules: {
    orderNo: [
      {required: true, message: "出库单号不能为空", trigger: "blur"}
    ],
    optType: [
      {required: true, message: "出库类型不能为空", trigger: "change"}
    ],
    warehouseId: [
      {required: true, message: "请选择仓库", trigger: ['blur', 'change']}
    ],
  }
});
const {form, rules} = toRefs(data);
const cancel = async () => {
  await proxy?.$modal.confirm('确认取消编辑出库单吗？');
  close()
}
const close = () => {
  const obj = {path: "/shipmentOrder"};
  proxy?.$tab.closeOpenPage(obj);
}
const inventorySelectShow = ref(false)

// 选择商品 start
const showAddItem = () => {
  inventorySelectRef.value.getList()
  inventorySelectShow.value = true
}
// 选择成功
const handleOkClick = (item) => {
  inventorySelectShow.value = false
  selectedInventory.value = [...item]
  item.forEach(it => {
    if (!form.value.details.find(detail => getWarehouseAndSkuKey(detail) === getWarehouseAndSkuKey(it))) {
      form.value.details.push(
        {
          itemSku: it.itemSku,
          item: it.item,
          skuId: it.skuId,
          amount: undefined,
          quantity: undefined,
          warehouseId: form.value.warehouseId,
          inventoryId: it.id,
          stockCode: it.stockCode || '',
          _originalStockCode: it.stockCode || '',
          _tempLocationSelect: ''
        })
    }
  })
}
// 选择商品 end

// 初始化receipt-order-form ref
const shipmentForm = ref()

const save = async () => {
  await proxy?.$modal.confirm('确认暂存出库单吗？');
  doSave()
}

const getParamsBeforeSave = (orderStatus) => {
  let details = []
  if (form.value.details?.length) {
    // 构建参数
    details = form.value.details.map(it => {
      return {
        id: it.id,
        receiptOrderId: form.value.id,
        skuId: it.skuId,
        amount: it.amount,
        quantity: it.quantity,
        warehouseId: form.value.warehouseId,
        stockCode: it.stockCode || undefined,
      }
    })
  }

  return {
    id: form.value.id,
    orderNo: form.value.orderNo,
    optType: form.value.optType,
    merchantId: form.value.merchantId,
    bizOrderNo: form.value.bizOrderNo,
    orderStatus,
    remark: form.value.remark,
    totalAmount: form.value.totalAmount,
    totalQuantity: form.value.totalQuantity,
    warehouseId: form.value.warehouseId,
    details: details
  }
}

const doSave = (orderStatus = 0) => {
  //验证shipmentForm表单
  shipmentForm.value?.validate((valid) => {
    // 校验
    if (!valid) {
      return ElMessage.error('请填写必填项')
    }

    //('提交前校验',form.value)
    const params = getParamsBeforeSave(orderStatus)

    loading.value = true
    if (params.id) {
      updateShipmentOrder(params).then((res) => {
        if (res.code === 200) {
          ElMessage.success(res.msg)
          close()
        } else {
          ElMessage.error(res.msg)
        }
      }).finally(()=>{
        loading.value = false
      })
    } else {
      addShipmentOrder(params).then((res) => {
        if (res.code === 200) {
          ElMessage.success(res.msg)
          close()
        } else {
          ElMessage.error(res.msg)
        }
      }).finally(()=>{
        loading.value = false
      })
    }
  })
}

const doShipment = async () => {
  await proxy?.$modal.confirm('确认出库吗？');
  shipmentForm.value?.validate((valid) => {
    // 校验
    if (!valid) {
      return ElMessage.error('请填写必填项')
    }
    if (!form.value.details?.length) {
      return ElMessage.error('请选择商品')
    }
    const invalidQuantityList = form.value.details.filter(it => !it.quantity)
    if (invalidQuantityList?.length) {
      return ElMessage.error('请选择数量')
    }
    const invalidLocationList = form.value.details.filter(it => !it.stockCode)
    if (invalidLocationList?.length) {
      return ElMessage.error('请选择库位')
    }
    const params = getParamsBeforeSave(1)

    loading.value = true
    shipment(params).then((res) => {
      if (res.code === 200) {
        ElMessage.success('出库成功')
        close()
      } else {
        ElMessage.error(res.msg)
      }
    }).finally(()=>{
      loading.value = false
    })
  })
}

const updateToInvalid = async () => {
  await proxy?.$modal.confirm('确认作废出库单吗？');
  doSave(-1)
}

const route = useRoute();
onMounted(() => {
  const id = route.query && route.query.id;
  if (id) {
    loadDetail(id)
  } else {
    form.value.orderNo = 'CK' + generateNo()
  }
})


// 获取详情
const loadDetail = (id) => {
  loading.value = true
  getShipmentOrder(id).then((response) => {
    if (response.data.details?.length) {
      selectedInventory.value = response.data.details.map(it => {
        return {
          id: it.id,
          skuId: it.skuId,
          warehouseId: it.warehouseId
        }
      })
    }
    form.value = {...response.data}

    inventorySelectRef.value.setWarehouseId(form.value.warehouseId)
    Promise.resolve();
  }).then(() => {
  }).finally(() => {
    loading.value = false
  })
}


const handleChangeWarehouse = (e) => {
  form.value.details = []
  inventorySelectRef.value.setWarehouseId(form.value.warehouseId)
}

const handleChangeQuantity = () => {
  let sum = 0
  form.value.details.forEach(it => {
    if (it.quantity) {
      sum += Number(it.quantity)
    }
  })
  form.value.totalQuantity = sum
}

const handleAutoCalc = () => {
  let sum = undefined
  form.value.details.forEach(it => {
    if (it.amount >= 0) {
      if (!sum) {
        sum = 0
      }
      sum = numSub(sum, -Number(it.amount))
    }
  })
  form.value.totalAmount = sum
}

const handleDeleteDetail = (row, index) => {
  if (row.id) {
    proxy.$modal.confirm('确认删除本条商品明细吗？如确认会立即执行！').then(function () {
      loading.value = true;
      return delShipmentOrderDetail(row.id);
    }).then(() => {
      form.value.details.splice(index, 1)
      proxy.$modal.msgSuccess("删除成功");
    }).finally(()=>{
      loading.value=false
    })
  } else {
    form.value.details.splice(index, 1)
  }
  const indexOfSelected = selectedInventory.value.findIndex(it => getWarehouseAndSkuKey(it) === getWarehouseAndSkuKey(row))
  selectedInventory.value.splice(indexOfSelected, 1)
}

// 解析库位编码字符串为数组
const parseLocationCodes = (stockCode) => {
  if (!stockCode) {
    return []
  }
  return stockCode.split(',').filter(code => code.trim())
}

// 处理移除库位标签
const handleRemoveLocation = (row, index) => {
  const codes = parseLocationCodes(row.stockCode)
  codes.splice(index, 1)

  if (codes.length === 0) {
    row.stockCode = ''
    ElMessage.warning('请至少保留一个库位')
  } else {
    row.stockCode = codes.join(',')
  }
}

// 处理添加库位
const handleAddLocation = (row, locationCode) => {
  if (!locationCode) {
    return
  }

  const codes = parseLocationCodes(row.stockCode || '')

  // 检查是否已存在
  if (codes.includes(locationCode)) {
    ElMessage.warning('该库位已添加')
    row._tempLocationSelect = ''
    return
  }

  codes.push(locationCode)
  row.stockCode = codes.join(',')
  row._tempLocationSelect = ''
}


// 处理一键恢复原始值
const handleRestoreLocation = (row) => {
  row.stockCode = row._originalStockCode
  row._showLocationSelect = false
  ElMessage.success('已恢复原始库位')
}


// 获取指定仓库的库位列表
const fetchLocationList = async (warehouseId) => {
  if (!warehouseId) {
    currentLocationList.value = []
    return
  }

  // 如果已经缓存过，直接返回
  if (locationListCache.value[warehouseId]) {
    currentLocationList.value = locationListCache.value[warehouseId]
    return
  }

  try {
    locationLoading.value = true
    const response = await listLocation({
      warehouseId: warehouseId,
      pageNum: 1,
      pageSize: 9999
    })

    // 提取库位编号并缓存
    const locations = (response.rows || []).map(item => item.stockCode).filter(code => code)
    locationListCache.value[warehouseId] = locations
    currentLocationList.value = locations
  } catch (error) {
    console.error('获取库位列表失败:', error)
    currentLocationList.value = []
  } finally {
    locationLoading.value = false
  }
}

// 监听仓库变化，自动加载库位列表
watch(() => form.value.warehouseId, (newWarehouseId) => {
  if (newWarehouseId) {
    fetchLocationList(newWarehouseId)
  } else {
    currentLocationList.value = []
  }
}, { immediate: true })

const getLocationList = (row) => {
  // 解析当前行的库位编码
  const currentCodes = parseLocationCodes(row.stockCode || '')

  // 合并API返回的库位和已使用的库位
  const existingLocations = form.value.details
    .filter(item => item.stockCode && item !== row)
    .map(item => parseLocationCodes(item.stockCode))
    .flat()

  // 合并并去重，排除当前行已有的库位
  const allLocations = [...new Set([...currentLocationList.value, ...existingLocations])]
    .filter(loc => !currentCodes.includes(loc))

  return allLocations.sort()
}

</script>

<style lang="scss" scoped>
@import "@/assets/styles/variables.module";

.btn-box {
  width: calc(100% - #{$base-sidebar-width});
  display: flex;
  align-items: center;
  justify-content: space-between;
  float: right;
}

.el-statistic__content {
  font-size: 14px;
}

.location-tags-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-height: 32px;

  .location-tag {
    margin: 2px;
    font-size: 14px;
  }

  .restore-btn {
    margin-left: 4px;
    font-size: 14px;
  }

  :deep(.el-select) {
    .el-input__wrapper {
      box-shadow: none;
      border: 1px dashed #dcdfe6;

      &:hover {
        border-color: #409eff;
      }
    }
  }
}
</style>
