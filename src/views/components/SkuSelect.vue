<template>
  <el-drawer :model-value="show" title="商品选择" @close="handleCancelClick" :size="size" :close-on-click-modal="false" append-to-body>
    <el-form :inline="true" label-width="68px">
      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item label="商品名称">
            <el-input v-model="query.itemName" clearable placeholder="商品名称"></el-input>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="商品编号">
            <el-input class="w200" v-model="query.itemCode" clearable placeholder="商品编号"></el-input>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="规格名称">
            <el-input class="w200" v-model="query.skuName" clearable placeholder="规格名称"></el-input>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item label="规格编号">
            <el-input class="w200" v-model="query.barcode" clearable placeholder="规格编号"></el-input>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-button type="primary" @click="loadAll">查询</el-button>
        </el-col>
      </el-row>
    </el-form>
    <el-table :data="list" @selection-change="handleSelectionChange" border :row-key="getRowKey" empty-text="暂无商品" v-loading="loading" ref="skuSelectFormRef" cell-class-name="my-cell">
      <el-table-column type="selection" width="55" :reserve-selection="true" v-if="!singleSelect" :selectable="judgeSelectable"/>
      <el-table-column label="商品信息" prop="itemId">
        <template #default="{ row }">
          <div>{{ row.item.itemName }}</div>
          <div v-if="row.item.itemCode">编号：{{ row.item.itemCode }}</div>
          <div v-if="row.item.itemBrand">品牌：{{ useWmsStore().itemBrandMap.get(row.item.itemBrand).brandName }}</div>
        </template>
      </el-table-column>
      <el-table-column label="规格信息">
        <template #default="{ row }">
          <div>{{ row.itemSku.skuName }}</div>
          <div v-if="row.itemSku.skuCode">编号/条码：{{ row.itemSku.skuCode }}</div>
<!--          <div v-if="row.itemSku.barcode">条码：{{ row.itemSku.barcode }}</div>-->
        </template>
      </el-table-column>
      <el-table-column label="价格(元)" width="160" align="left">
        <template #default="{ row }">
          <div v-if="row.itemSku.costPrice" class="flex-space-between">
            <span>成本价：</span>
            <div>{{ (row.itemSku.costPrice || row.itemSku.costPrice === 0) ? row.itemSku.costPrice : '' }}</div>
          </div>
          <div v-if="row.itemSku.sellingPrice" class="flex-space-between">
            <span>销售价：</span>
            <div>{{ (row.itemSku.sellingPrice || row.itemSku.sellingPrice === 0) ? row.itemSku.sellingPrice : '' }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="重量(kg)" width="160" align="left">
        <template #default="{ row }">
          <div v-if="row.itemSku.netWeight" class="flex-space-between">
            <span>净重：</span>
            <div>{{ (row.itemSku.netWeight || row.itemSku.netWeight === 0) ? row.itemSku.netWeight : '' }}</div>
          </div>
          <div v-if="row.itemSku.grossWeight" class="flex-space-between">
            <span>毛重：</span>
            <div>{{ (row.itemSku.grossWeight || row.itemSku.grossWeight === 0) ? row.itemSku.grossWeight : '' }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="长宽高(cm)" align="right" width="250">
        <template #default="{ row }">
          <div>{{ getVolumeText(row) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" v-if="singleSelect" align="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleChooseSku(row)">选择</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-row>
      <pagination v-show="total > 0" :total="total" :page-sizes="[5, 10, 20, 50]" v-model:limit="pageReq.size" v-model:page="pageReq.page"
                  @pagination="getList" class="mr10"/>
    </el-row>
    <template v-slot:footer>
      <div style="width: 100%;display: flex;justify-content: space-between">
        <span>
          <el-button @click="handleAddItem" icon="Plus">创建商品</el-button>
          <el-button @click="loadAll" icon="Refresh">刷新</el-button>
        </span>
        <span>
          <el-button @click="handleCancelClick">取消</el-button>
          <el-button type="primary" @click="handleOkClick" v-if="!singleSelect">确认</el-button>
      </span>
      </div>
    </template>
  </el-drawer>

  <el-drawer :title="addItemDialog.title" v-model="addItemDialog.visible" size="80%" append-to-body :close-on-click-modal="false">
    <div v-loading="addItemLoading">
      <el-card>
        <el-form ref="itemFormRef" :model="addItemForm" :rules="addItemRules" label-width="108px">
          <el-row :gutter="24">
            <el-col :span="12">
              <el-form-item label="商品名称" prop="itemName">
                <el-input v-model="addItemForm.itemName" placeholder="请输入名称"/>
              </el-form-item>
            </el-col>
            <el-col :span="10">
              <el-form-item label="商品分类" prop="itemCategory">
                <el-tree-select
                  ref="treeRef"
                  v-model="addItemForm.itemCategory"
                  :data="itemCategoryTreeSelectList"
                  :props="{ value: 'id', label: 'label', children: 'children' }"
                  value-key="id"
                  placeholder="请选择分类"
                  check-strictly
                  style="width: 100%!important;"
                />
              </el-form-item>
            </el-col>
            <el-col :span="1">
              <el-button link icon="Plus" type="primary" style="height: 32px!important;line-height: 32px!important;"
                         @click="handleAddType">新增分类
              </el-button>
            </el-col>
          </el-row>
          <el-row :gutter="24">
            <el-col :span="12">
              <el-form-item label="商品编号" prop="itemCode">
                <el-input v-model="addItemForm.itemCode" placeholder="请输入编号"/>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="商品单位" prop="unit">
                <el-input v-model="addItemForm.unit" placeholder="请输入单位类别"/>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="24">
            <el-col :span="12">
              <el-form-item label="商品品牌" prop="itemBrand">
                <el-select v-model="addItemForm.itemBrand" clearable filterable style="width: 100%!important;">
                  <el-option
                    v-for="item in useWmsStore().itemBrandList"
                    :key="item.id"
                    :label="item.brandName"
                    :value="item.id"
                  ></el-option>
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </el-card>
      <el-card class="mt20">
        <template #header>
          <div class="card-header">
            <span>规格</span>
          </div>
        </template>
        <el-form :model="addItemSkuForm" :rules="addItemSkuRules" ref="addItemSkuFormRef" :show-message="false">
          <el-table :data="addItemSkuForm.itemSkuList" border cell-class-name="my-cell">
            <el-table-column label="规格名称" prop="skuName">
              <template #default="scope">
                <el-form-item :prop="'itemSkuList.' + scope.$index + '.skuName'" :rules="addItemSkuRules.skuName"
                              style="margin-bottom: 0!important;">
                  <el-input v-model="scope.row.skuName" placeholder="请输入规格名称"/>
                </el-form-item>
              </template>
            </el-table-column>
            <el-table-column label="编号/条码" width="250">
              <template #default="scope">
                <div class="flex-center">
                  <span class="mr5" style="width: 50px">编号/条码</span>
                  <el-input v-model="scope.row.skuCode" />
                </div>
<!--                <div class="flex-center mt5">
                  <span class="mr5" style="width: 50px">条码</span>
                  <el-input v-model="scope.row.barcode" />
                </div>-->
              </template>
            </el-table-column>
            <el-table-column label="长/宽/高(cm)" width="200">
              <template #default="scope">
                <div class="flex-center">
                  <span class="mr5">长</span>
                  <el-input-number :controls="false" :min="0" :precision="1" class="mr5" v-model="scope.row.length" />
                </div>
                <div class="flex-center mt5">
                  <span class="mr5">宽</span>
                  <el-input-number :controls="false" :min="0" :precision="1" class="mr5" v-model="scope.row.width" />
                </div>
                <div class="flex-center mt5">
                  <span class="mr5">高</span>
                  <el-input-number :controls="false" :min="0" :precision="1" v-model="scope.row.height" />
                </div>
              </template>
            </el-table-column>
            <el-table-column label="净重/毛重(kg)" width="240">
              <template #default="scope">
                <div class="flex-center">
                  <span class="mr5">净重</span>
                  <el-input-number :controls="false" :min="0" :precision="3" v-model="scope.row.netWeight"/>
                </div>
                <div class="flex-center mt5">
                  <span class="mr5">毛重</span>
                  <el-input-number :controls="false" :min="0" :precision="3" v-model="scope.row.grossWeight"/>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="成本价/销售价(元)" width="240">
              <template #default="scope">
                <div class="flex-center">
                  <span class="mr5">成本价</span>
                  <el-input-number :controls="false" :min="0" :precision="2" v-model="scope.row.costPrice"/>
                </div>
                <div class="flex-center mt5">
                  <span class="mr5">销售价</span>
                  <el-input-number :controls="false" :min="0" :precision="2" v-model="scope.row.sellingPrice"/>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="操作" class-name="small-padding fixed-width" width="80" align="right">
              <template #default="scope">
                <el-button link icon="Delete" type="primary" @click="handleDeleteItemSku(scope.$index)">删除</el-button>
              </template>
            </el-table-column>
            <template #append v-if="addItemSkuForm.itemSkuList.length">
              <div style="padding: 6px 2px 6px 2px;text-align: center;">
                <el-button text class="add-btn" icon="Plus" type="primary" @click="onAppendBtnClick">添加商品规格
                </el-button>
              </div>
            </template>
            <template #empty>
              <div style="padding: 2px 2px 6px 2px;text-align: center;width: 100%!important;">
                <el-button text class="add-btn" icon="Plus" type="primary" @click="onAppendBtnClick">添加商品规格
                </el-button>
              </div>
            </template>
          </el-table>
        </el-form>
      </el-card>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button :loading="addItemSubmitLoading" type="primary" @click="submitAddItemForm">确 定</el-button>
        <el-button @click="cancelAddItem">取 消</el-button>
      </div>
    </template>
  </el-drawer>

  <el-dialog :title="categoryDialog.title" v-model="categoryDialog.visible" width="500px" append-to-body :close-on-click-modal="false">
    <el-form ref="itemCategoryFormRef" :model="categoryForm" :rules="categoryRules" label-width="128px">
      <el-form-item label="上级分类" prop="parentId">
        <el-tree-select
          v-model="categoryForm.parentId"
          :data="itemCategoryTreeSelectList"
          :props="{ value: 'id', label: 'label', children: 'children' }"
          value-key="id"
          placeholder="上级分类"
          check-strictly
          style="width: 100%!important;"
          clearable
        />
      </el-form-item>
      <el-form-item label="商品分类名称" prop="categoryName">
        <el-input v-model="categoryForm.categoryName" placeholder="请输入商品分类名称" @keyup.enter="submitCategoryForm"/>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button :loading="addItemSubmitLoading" type="primary" @click="submitCategoryForm">确 定</el-button>
        <el-button @click="categoryDialog.visible = false">取 消</el-button>
      </div>
    </template>
  </el-dialog>
</template>
<script setup lang="ts" name="SkuSelect">
import {computed, getCurrentInstance, onMounted, reactive, ref, nextTick} from 'vue';
import {ElForm} from "element-plus";
import {listItemSkuPage} from "@/api/wms/itemSku";
import {useRouter} from "vue-router";
import {useWmsStore} from '@/store/modules/wms'
import {getItem, addItem, updateItem} from '@/api/wms/item';
import {addItemCategory, updateItemCategory} from "@/api/wms/itemCategory";

const { proxy } = getCurrentInstance()

const router = useRouter()
const loading = ref(false)
const deptOptions = ref([]);
const query = reactive({
  itemName: '',
  itemCode: '',
  skuName: '',
  barcode: ''
});
const selectItemSkuVoCheck = ref([])
const skuSelectFormRef = ref(null)
const total = ref(0);
const pageReq = reactive({
  page: 1,
  size: 10,
});
const list = ref([]);
const rightList = ref([]);
const rightListKeySet = computed(() => {
  const set = new Set();
  rightList.value.forEach((it) => set.add(it.id));
  return set
});

const loadAll = () => {
  pageReq.page = 1
  getList()
};
const getRowKey = (row: any) => {
  return row.id;
}
const getList = () => {
  const data = {
    ...query,
    pageNum: pageReq.page,
    pageSize: pageReq.size
  }
  loading.value = true
  listItemSkuPage(data).then((res) => {
    const content = [...res.rows];
    list.value = content.map((it) => ({...it, id: it.skuId, checked: false}));
    total.value = res.total;
  }).then(() => toggleSelection()).finally(() => loading.value = false);
}

const addItemDialog = reactive({
  visible: false,
  title: '新增商品'
});
const addItemLoading = ref(false);
const addItemSubmitLoading = ref(false);
const itemFormRef = ref(ElForm);
const treeRef = ref(null);
const itemCategoryTreeSelectList = computed(() => useWmsStore().itemCategoryTreeList);

const initAddItemFormData = {
  id: undefined,
  itemCode: undefined,
  itemName: undefined,
  itemCategory: undefined,
  unit: undefined,
  itemBrand: undefined,
  remark: undefined,
}

const addItemForm = reactive({...initAddItemFormData});

const addItemRules = {
  itemName: [
    {required: true, message: "名称不能为空", trigger: "blur"}
  ],
  itemCategory: [
    {required: true, message: "分类不能为空", trigger: "blur"}
  ],
}

const addItemSkuForm = reactive({
  itemSkuList: []
})

const addItemSkuFormRef = ref(ElForm)
const addItemSkuRules = {
  skuName: [{required: true, message: '规格名称不能为空', trigger: 'blur'}]
}

const categoryDialog = reactive({
  visible: false,
  title: '新增商品分类'
});
const itemCategoryFormRef = ref(ElForm);
const categoryForm = reactive({
  id: undefined,
  parentId: undefined,
  categoryName: undefined,
});
const categoryRules = {
  categoryName: [
    {required: true, message: "商品分类名称不能为空", trigger: "blur"}
  ],
}

const resetAddItemSkuList = () => {
  addItemSkuForm.itemSkuList = []
  addItemSkuForm.itemSkuList.push({
    id: '',
    itemId: '',
    barcode: '',
    skuCode: '',
    costPrice: null,
    sellingPrice: null,
    skuName: '',
    length: null,
    width: null,
    height: null,
    netWeight: null,
    grossWeight: null,
  })
}

const onAppendBtnClick = () => {
  addItemSkuForm.itemSkuList.push({
    id: '',
    itemId: '',
    barcode: '',
    skuCode: '',
    costPrice: null,
    sellingPrice: null,
    skuName: '',
    length: null,
    width: null,
    height: null,
    netWeight: null,
    grossWeight: null,
  })
}

const handleDeleteItemSku = (index) => {
  if (addItemSkuForm.itemSkuList.length === 1) {
    return proxy?.$modal.msgError("至少包含一个商品规格");
  }
  addItemSkuForm.itemSkuList.splice(index, 1);
}

const handleAddItem = () => {
  resetAddItemSkuList()
  addItemDialog.visible = true;
  addItemDialog.title = "新增商品";
  nextTick(async () => {
    Object.assign(addItemForm, initAddItemFormData);
    itemFormRef.value?.resetFields();
  });
}

const cancelAddItem = () => {
  addItemDialog.visible = false;
  resetAddItemSkuList();
}

const submitAddItemForm = () => {
  // 将 skuCode 赋值给 barcode
  addItemSkuForm.itemSkuList.forEach(sku => {
    if (sku.skuCode) {
      sku.barcode = sku.skuCode;
    }
  });
  addItemForm.sku = addItemSkuForm.itemSkuList
  itemFormRef.value.validate(async (valid) => {
    if (valid) {
      let flag = true
      if (!addItemSkuForm.itemSkuList || addItemSkuForm.itemSkuList.length === 0) {
        proxy?.$modal.msgError("至少包含一个商品规格");
        flag = false
      }
      await addItemSkuFormRef.value.validate((valid2) => {
        if (!valid2) {
          flag = false;
        }
      })
      if (flag) {
        addItemSubmitLoading.value = true;
        addItem(addItemForm).then((res) => {
          if (res.code === 200) {
            proxy?.$modal.msgSuccess("新增成功");
            addItemDialog.visible = false;
            getList();
          } else {
            proxy?.$modal.msgError(res.msg);
          }
        }).finally(() => {
          addItemSubmitLoading.value = false;
        });
      }
    }
  });
}

const handleAddType = () => {
  categoryDialog.title = "新增商品分类";
  categoryDialog.visible = true;
  nextTick(() => {
    categoryForm.id = undefined;
    categoryForm.parentId = undefined;
    categoryForm.categoryName = undefined;
  });
}

const submitCategoryForm = () => {
  itemCategoryFormRef.value.validate(async (valid) => {
    if (valid) {
      addItemSubmitLoading.value = true;
      const apiCall = categoryForm.id ? updateItemCategory(categoryForm) : addItemCategory(categoryForm);
      apiCall.then((res) => {
        if (res.code === 200) {
          proxy?.$modal.msgSuccess(categoryForm.id ? '修改成功' : '新增成功');
          categoryDialog.visible = false;
          useWmsStore().getItemCategoryList();
          useWmsStore().getItemCategoryTreeList();
        } else {
          proxy?.$modal.msgError(res.msg);
        }
      }).finally(() => {
        addItemSubmitLoading.value = false;
      });
    }
  });
}

// Deleted:const goCreateItem = () => {
// Deleted:  const data = proxy.$router.resolve({path: '/system/itemManage2', query: {openDrawer: true}})
// Deleted:  window.open(data.href, '_blank')
// Deleted:}
// 定义props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: '30%'
  },
  singleSelect:{
    type: Boolean,
    default: false
  },
  selectedSku: {
    type: Array,
    default: []
  }
})

const show = computed(() => {
  return props.modelValue;
})

// 定义事件
const emit = defineEmits<{
  (e: 'handleCancelClick')
  (e: 'handleOkClick', value)
  (e: 'handleSingleOkClick', value)
}>()

function handleCancelClick() {
  emit('handleCancelClick');
  clearQuantity()
}

function handleChooseSku(row) {
  emit('handleSingleOkClick', row);
}

function handleOkClick() {
  emit('handleOkClick', selectItemSkuVoCheck.value);
  clearQuantity()
}
/** 多选框选中数据 */
const handleSelectionChange = (selection) => {
  selectItemSkuVoCheck.value = selection
}

const toggleSelection = () => {
  props.selectedSku.forEach(selected => {
    const index = list.value.findIndex(it => selected.id=== it.id)
    if (index !== -1) {
      skuSelectFormRef.value.toggleRowSelection(list.value[index], true)
    }
  })
}

const judgeSelectable = (row) => {
  if (props.selectedSku.find(selected => selected.id === row.id)) {
    return false;
  }
  return true
}


function clearQuantity() {
  skuSelectFormRef.value.clearSelection()
}

const getVolumeText = (row) => {
  if((row.length || row.length === 0) && (row.width || row.width === 0) && (row.height || row.height === 0)) {
    return row.length + ' * ' + row.width + ' * ' + row.height
  }
  return ((row.length || row.length === 0) ? ('长：' + row.length) : '')
    + ((row.width || row.width === 0) ? (' 宽：' + row.width) : '')
    + ((row.height || row.height === 0) ? (' 高：' + row.height) : '')
}
defineExpose({
  getList
})
</script>
<style lang="scss">
.el-table .my-cell {
  vertical-align: top
}

.flex-center {
  display: flex;
  align-items: center;
}

.mr5 {
  margin-right: 5px;
}

.mt5 {
  margin-top: 5px;
}

.add-btn {
  width: 100%;
}
</style>
