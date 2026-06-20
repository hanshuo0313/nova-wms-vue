<template>
  <div class="app-container">
    <el-card>
      <el-form :model="queryParams" ref="queryFormRef" :inline="true" label-width="68px">
        <el-form-item label="商品编号" prop="itemCode">
          <el-input v-model="queryParams.itemCode" placeholder="请输入商品编号" clearable @keyup.enter="handleQuery"/>
        </el-form-item>
        <el-form-item label="商品名称" prop="itemName">
          <el-input v-model="queryParams.itemName" placeholder="请输入商品名称" clearable @keyup.enter="handleQuery"/>
        </el-form-item>
        <el-form-item label="商品品牌" prop="itemBrand">
          <el-select v-model="queryParams.itemBrand" clearable filterable>
            <el-option
              v-for="item in useWmsStore().itemBrandList"
              :key="item.id"
              :label="item.brandName"
              :value="item.id"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="商品单位" prop="unit">
          <el-select v-model="queryParams.unit" clearable filterable placeholder="请选择单位">
            <el-option
              v-for="item in useWmsStore().merchantList"
              :key="item.id"
              :label="item.merchantName"
              :value="item.id"
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
      <div>
        <div style="display: flex;align-items: start;justify-content: space-between">
          <span class="mr10" style="font-size: 18px;">商品列表</span>
          <div>
            <el-button type="primary" plain icon="FolderOpened" @click="categoryDrawerVisible = true" class="mb10">商品分类</el-button>
            <el-button type="primary" plain icon="Plus" @click="handleAdd" class="mb10">新增商品</el-button>
            <el-button type="primary" plain icon="Download" :disabled="selectedRows.length === 0" @click="handleDownloadProductCode" class="mb10">
              下载商品码{{ selectedRows.length > 0 ? `(${selectedRows.length})` : '' }}
            </el-button>
            <el-button type="primary" plain icon="Download" :disabled="selectedRows.length === 0" @click="handleBatchDownloadBarcode" class="mb10">
              下载规格条码{{ selectedRows.length > 0 ? `(${selectedRows.length})` : '' }}
            </el-button>
            <el-button type="primary" plain icon="Download" @click="handleExport" :loading="exportLoading" class="mb10">导出Excel</el-button>
<!--            <el-button type="primary" plain icon="Download" :disabled="selectedRows.length === 0" @click="handleBatchDownloadQrcode" class="mb10">
              下载二维码{{ selectedRows.length > 0 ? `(${selectedRows.length})` : '' }}
            </el-button>-->
          </div>
        </div>
        <el-table :data="itemList" @selection-change="handleSelectionChange" :span-method="spanMethod" border empty-text="暂无商品" v-loading="loading" cell-class-name="my-cell">
          <el-table-column type="selection" width="55" />
          <el-table-column label="商品图片" align="center" width="80">
            <template #default="{ row }">
              <el-image
                v-if="hasValidImage(row)"
                :src="itemImageUrls[row.item.id][0]"
                :preview-src-list="itemImageUrls[row.item.id]"
                fit="cover"
                style="width: 50px; height: 50px;"
                preview-teleported
                @error="handleImageError(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="商品名称" prop="itemId" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.item.itemName }}
            </template>
          </el-table-column>
          <el-table-column label="商品编号" prop="itemId" align="center" min-width="110" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.item.itemCode }}
            </template>
          </el-table-column>
          <el-table-column label="商品单位" prop="itemId" align="center" min-width="90" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.item.unit ? useWmsStore().merchantMap.get(row.item.unit)?.merchantName : '' }}
            </template>
          </el-table-column>
          <el-table-column label="商品分类" prop="itemId" align="center" min-width="100" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.item.itemCategory ? useWmsStore().itemCategoryMap.get(row.item.itemCategory)?.categoryName : '' }}
            </template>
          </el-table-column>
          <el-table-column label="商品品牌" prop="itemId" align="center" min-width="100" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.item.itemBrand ? useWmsStore().itemBrandMap.get(row.item.itemBrand)?.brandName : '' }}
            </template>
          </el-table-column>
          <el-table-column label="商品级别" prop="itemId" align="center" width="90">
            <template #default="{ row }">
              <dict-tag :options="product_level" :value="row.item.itemLevel"/>
            </template>
          </el-table-column>
          <el-table-column label="规格信息" prop="skuName" align="left" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <div>{{ row.itemSku.skuName }}</div>
              <div v-if="row.itemSku.skuCode">编号：{{ row.itemSku.skuCode }}</div>
<!--                <div v-if="row.itemSku.barcode">条码：{{ row.itemSku.barcode }}</div>-->
            </template>
          </el-table-column>
          <el-table-column label="金额(元)"  align="left">
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
          <el-table-column label="重量(kg)"  align="left">
            <template #default="{ row }">
              <div v-if="row.itemSku.netWeight" class="flex-space-between">
                <span>净重：</span>
                <div>
                  {{ (row.itemSku.netWeight || row.itemSku.netWeight === 0) ? row.itemSku.netWeight : '' }}
                </div>
              </div>
              <div v-if="row.itemSku.grossWeight" class="flex-space-between">
                <span>毛重：</span>
                <div>
                  {{ (row.itemSku.grossWeight || row.itemSku.grossWeight === 0) ? row.itemSku.grossWeight : '' }}
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="长宽高(cm)" align="left" >
            <template #default="{ row }">
              <div>{{ getVolumeText(row.itemSku) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="操作" align="left" prop="itemId" width="120">
            <template #default="scope">
              <div>
                <el-button link type="primary" @click="handleDelete(scope.row)" icon="Delete">删除</el-button>
              </div>
              <div>
                <el-button link type="primary" @click="handleUpdate(scope.row)" icon="Edit">修改</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <pagination v-show="total>0" :total="total" v-model:page="queryParams.pageNum"
                    v-model:limit="queryParams.pageSize" @pagination="getList"/>
      </div>
    </el-card>

    <!-- 商品分类抽屉 -->
    <el-drawer title="商品分类" v-model="categoryDrawerVisible" direction="rtl" size="600px" append-to-body>
      <div style="display: flex;align-items: center;justify-content: flex-end;margin-bottom: 10px;">
        <el-button style="font-size:12px;line-height: 14px" plain
                 @click="handleAddType(false)"
                 type="primary" icon="Plus">新增分类
        </el-button>
      </div>
      <el-tree
        :data="itemCategoryTreeOptionsList"
        :props="{ value: 'id', label: 'label', children: 'children' }"
        value-key="id"
        class="mr10 mt10"
        @nodeClick="handleQueryType"
        :default-expand-all="true"
        :highlight-current="true"
        node-key="label"
        current-node-key="全部"
        draggable
        :allow-drop="collapse"
        @node-drop="handleNodeDrop"
        :expand-on-click-node="false"
      >
        <template #default="{ node, data }">
        <span class="custom-tree-node">
          <span>{{ node.label }}</span>
          <span>
            <el-button type="primary" @click.stop="append(data)" link
                     v-if="data.label !== '全部' && node.level < 2" icon="Plus" style="font-size: 12px">新增子分类</el-button>
            <el-button type="primary" @click.stop="remove(node, data)" link
                     v-if="data.label !== '全部'" icon="Delete" style="font-size: 12px">删除</el-button>
            <el-button type="primary" icon="Edit" @click.stop="edit(node, data)" link
                     v-if="data.label !== '全部'" style="font-size: 12px">修改</el-button>
          </span>
        </span>
        </template>
      </el-tree>
    </el-drawer>
    <!-- 添加或修改物料对话框 -->
    <el-drawer :title="dialog.title" v-model="dialog.visible" size="80%" append-to-body :close-on-click-modal="false">
      <div v-loading="skuLoading">
        <el-card>
          <el-form ref="itemFormRef" :model="form" :rules="rules" label-width="108px">
            <el-row :gutter="24">
              <el-col :span="12">
                <el-form-item label="商品名称" prop="itemName">
                  <el-input v-model="form.itemName" placeholder="请输入名称"/>
                </el-form-item>
              </el-col>
              <el-col :span="10">
                <el-form-item label="商品分类" prop="itemCategory">
                  <el-tree-select
                    ref="treeRef"
                    v-model="form.itemCategory"
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
                           @click="handleAddType(true)">新增分类
                </el-button>
              </el-col>
            </el-row>
            <el-row :gutter="24">
              <el-col :span="12">
                <el-form-item label="商品编号" prop="itemCode">
                  <el-input v-model="form.itemCode" placeholder="请输入编号"/>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="商品单位" prop="unit">
                  <el-select v-model="form.unit" clearable filterable placeholder="请选择单位" style="width: 100%!important;">
                    <el-option
                      v-for="item in useWmsStore().merchantList"
                      :key="item.id"
                      :label="item.merchantName"
                      :value="item.id"
                    ></el-option>
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="24">
              <el-col :span="12">
                <el-form-item label="商品品牌" prop="itemBrand">
                  <el-select v-model="form.itemBrand" clearable filterable style="width: 100%!important;">
                    <el-option
                      v-for="item in useWmsStore().itemBrandList"
                      :key="item.id"
                      :label="item.brandName"
                      :value="item.id"
                    ></el-option>
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="商品级别" prop="itemLevel">
                  <el-select v-model="form.itemLevel" clearable filterable placeholder="请选择级别" style="width: 100%!important;">
                    <el-option
                      v-for="dict in product_level"
                      :key="dict.value"
                      :label="dict.label"
                      :value="dict.value"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="24">
              <el-col :span="24">
                <el-form-item label="商品图片" prop="itemImage">
                  <image-upload v-model="form.itemImage" :limit="5" />
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
          <el-form :model="skuForm" :rules="skuRules" ref="skuFormRef" :show-message="false">
            <el-table :data="skuForm.itemSkuList" border cell-class-name="my-cell">
              <el-table-column label="规格名称" prop="skuName">
                <template #default="scope">
                  <el-form-item :prop="'itemSkuList.' + scope.$index + '.skuName'" :rules="skuRules.skuName"
                                style="margin-bottom: 0!important;">
                    <el-input v-model="scope.row.skuName" placeholder="请输入规格名称"/>
                  </el-form-item>
                </template>
              </el-table-column>
              <el-table-column label="编号" width="250">
                <template #default="scope">
                  <div class="flex-center">
                    <span class="mr5" style="width: 50px">编号</span>
                    <el-input v-model="scope.row.skuCode" />
                  </div>
<!--                  <div class="flex-center mt5">
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
                  <el-button link icon="Delete" type="primary" @click="handleDeleteItemSku(scope.row, scope.$index)">删除</el-button>
                </template>
              </el-table-column>
              <template #append v-if="skuForm.itemSkuList.length">
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
          <el-button :loading="buttonLoading" type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-drawer>
    <!-- 添加或修改物料类型对话框 -->
    <el-dialog :title="categoryDialog.title" v-model="categoryDialog.visible" width="500px" append-to-body
               :close-on-click-modal="false">
      <el-form ref="itemCategoryFormRef" :model="categoryForm" :rules="typeRules" label-width="128px" @submit.native.prevent>
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
          <el-button :loading="buttonLoading" type="primary" @click="submitCategoryForm">确 定</el-button>
          <el-button @click="cancelType">取 消</el-button>
        </div>
      </template>
      <div id="qrcode"></div>
    </el-dialog>

    <!-- 批量下载对话框 -->
    <el-dialog
      :title="batchDownloadDialog.type === 'barcode' ? '批量下载条码' : '批量下载二维码'"
      v-model="batchDownloadDialog.visible"
      width="500px"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form label-width="100px">
        <el-form-item label="商品编号">
          <el-input v-model="batchDownloadDialog.itemCode" disabled />
        </el-form-item>
        <el-form-item label="起始编号">
          <el-input-number
            v-model="batchDownloadDialog.startNum"
            :min="1"
            :max="99999"
            controls-position="right"            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="结束编号">
          <el-input-number
            v-model="batchDownloadDialog.endNum"
            :min="1"
            :max="99999"
            controls-position="right"            style="width: 100%"
          />
        </el-form-item>
        <el-alert
          :title="`将生成 ${batchDownloadDialog.endNum - batchDownloadDialog.startNum + 1} 个${batchDownloadDialog.type === 'barcode' ? '条码' : '二维码'}`"
          type="info"
          :closable="false"
          show-icon
        />
        <div style="margin-top: 10px; color: #909399; font-size: 12px;">
          码值：{{ batchDownloadDialog.itemCode }}
        </div>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button :loading="batchDownloadDialog.loading" type="primary" @click="confirmBatchDownload">确 定</el-button>
          <el-button @click="batchDownloadDialog.visible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
<!--    <div id="outSkuIdBox" style="display: none">
      <img :src="qrcode"/>
      <canvas ref="barcode"></canvas>
    </div>-->
  </div>
</template>

<script setup name="Item">
import {getItem, delItem, addItem, updateItem} from '@/api/wms/item';
import {computed, getCurrentInstance, nextTick, onMounted, reactive, ref, toRefs} from 'vue';
import {ElForm, ElTree, ElTreeSelect} from 'element-plus';
import {
  updateItemCategory,
  addItemCategory,
  delItemCategory,
  updateOrderNum
} from "@/api/wms/itemCategory";
import {getRowspanMethod} from "@/utils/getRowSpanMethod";
import {listItemSkuPage, delItemSku, listItemSku} from "@/api/wms/itemSku";
import {useRoute} from "vue-router";
import Qrcode from 'qrcode'
import JSBarcode from 'jsbarcode'
import {useWmsStore} from '@/store/modules/wms'
import JSZip from 'jszip'
import {saveAs} from 'file-saver'
import * as XLSX from 'xlsx'
import { listByIds } from '@/api/system/oss'

const barcode = ref(null)
const route = useRoute()
const {proxy} = getCurrentInstance();
const { product_level } = proxy.useDict('product_level');
const itemList = ref([]);
const itemImageUrls = reactive({}); // itemId -> [url1, url2, ...] 图片 URL 数组

// 判断商品是否有有效图片
const hasValidImage = (row) => {
  const urls = itemImageUrls[row.item.id];
  return Array.isArray(urls) && urls.length > 0;
};

// 图片加载失败时移除 URL（不再显示占位图标）
const handleImageError = (row) => {
  delete itemImageUrls[row.item.id];
};

// 解析商品图片 ossId -> url（支持多张）
const resolveItemImages = async (items) => {
  const ossIds = items
    .map(r => r.item?.itemImage)
    .filter(Boolean)
    .flatMap(v => String(v).split(','))
    .filter(Boolean);
  const uniqueIds = [...new Set(ossIds)];
  if (!uniqueIds.length) return;
  try {
    const res = await listByIds(uniqueIds.join(','));
    const idUrlMap = {};
    (res.data || []).forEach(item => { idUrlMap[item.ossId] = item.url; });
    items.forEach(r => {
      if (r.item?.itemImage) {
        const ids = String(r.item.itemImage).split(',').filter(Boolean);
        const urls = ids.map(id => idUrlMap[id]).filter(Boolean);
        if (urls.length > 0) {
          itemImageUrls[r.item.id] = urls;
        }
      }
    });
  } catch (e) { /* ignore */ }
};
const itemCategoryTreeSelectList = computed(() => useWmsStore().itemCategoryTreeList);
const itemCategoryTreeOptionsList = computed(() => {
  let data = [...itemCategoryTreeSelectList.value];
  data.unshift({
    id: -1,
    label: '全部',
    children: []
  });
  return data;
});
const buttonLoading = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const skuLoading = ref(false)
const categoryDrawerVisible = ref(false)
const queryFormRef = ref(ElForm);
const itemFormRef = ref(ElForm);
const itemCategoryFormRef = ref(ElForm);
const spanMethod = computed(() => getRowspanMethod(itemList.value, rowSpanArray.value))
const rowSpanArray = ref(['itemId'])
const qrcode = ref(null)
const append = (data) => {
  // resetType();
  categoryForm.value.categoryName = undefined;
  categoryForm.value.parentId = data.id;
  categoryDialog.visible = true;
}

const remove = async (node, data) => {
  const ids = data.id
  await proxy?.$modal.confirm('确认删除分类【' + data.label + '】吗？');
  await delItemCategory(ids);
  proxy?.$modal.msgSuccess("删除成功");
  useWmsStore().getItemCategoryList();
  useWmsStore().getItemCategoryTreeList();
}
const edit = (node, data) => {
  if (node.level > 1) {
    categoryForm.value.parentId = node.parent.data.id
  }
  categoryForm.value.id = data.id;
  // resetType();
  categoryForm.value.categoryName = data.label;
  categoryDialog.title = "修改商品分类";
  categoryDialog.visible = true;
}

// 批量下载对话框
const batchDownloadDialog = reactive({
  visible: false,
  type: '', // 'barcode' or 'qrcode'
  itemCode: '',
  startNum: 1,
  endNum: 1,
  loading: false
})

// 打开批量下载对话框
const openBatchDownloadDialog = (row, type) => {
  if (!row.item.itemCode) {
    proxy?.$modal.msgWarning('该商品没有设置商品编号');
    return;
  }
  batchDownloadDialog.type = type;
  batchDownloadDialog.itemCode = row.item.itemCode;
  batchDownloadDialog.startNum = 1;
  batchDownloadDialog.endNum = 1;
  batchDownloadDialog.visible = true;
}

const dialog = reactive({
  visible: false,
  title: ''
});
const categoryDialog = reactive({
  visible: false,
  title: ''
});
const showParent = ref(false)
const initFormData = {
  id: undefined,
  itemCode: undefined,
  itemName: undefined,
  itemCategory: undefined,
  unit: undefined,
  itemBrand: undefined,
  itemImage: undefined,
  itemLevel: undefined,
  remark: undefined,
}
const initCategoryFormData = {
  id: undefined,
  parentId: undefined,
  ancestors: undefined,
  categoryName: undefined,
  orderNum: 0,
  status: undefined,
}
const data = reactive({
  form: {...initFormData},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    itemCode: undefined,
    itemName: undefined,
    itemType: undefined,
    unit: undefined
  },
  rules: {
    id: [
      {required: true, message: "不能为空", trigger: "blur"}
    ],
    itemName: [
      {required: true, message: "名称不能为空", trigger: "blur"}
    ],
    itemCode: [
      {required: true, message: "编号不能为空", trigger: "blur"}
    ],
    /*itemCategory: [
      {required: true, message: "分类不能为空", trigger: "blur"}
    ],*/
    warehouseId: [
      {required: true, message: "所属仓库不能为空", trigger: "blur"}
    ],
    quantity: [
      {required: true, message: "安全库存不能为空", trigger: "blur"}
    ],
    remark: [
      {required: true, message: "备注不能为空", trigger: "blur"}
    ],
  }
});
const categoryData = reactive({
  form: {...initCategoryFormData},
  queryParams: {
    pageNum: 1,
    pageSize: 1000,
    parentId: undefined,
    categoryName: undefined,
    orderNum: undefined,
    status: undefined,
  },
  rules: {
    id: [
      {required: true, message: "商品分类id不能为空", trigger: "blur"}
    ],
    // parentId: [
    //   {required: true, message: "父物料类型id不能为空", trigger: "blur"}
    // ],
    categoryName: [
      {required: true, message: "商品分类名称不能为空", trigger: "blur"}
    ],
    status: [
      {required: true, message: "商品分类状态不能为空", trigger: "change"}
    ],
  }
});
const {queryParams, form, rules} = toRefs(data);

const {queryParams: typeQueryParams, form: categoryForm, rules: typeRules} = toRefs(categoryData);
const currentType = ref()
/** 查询物料列表 */
const getList = async () => {
  loading.value = true;
  const res = await listItemSkuPage(queryParams.value);
  const content = [...res.rows];
  itemList.value = content.map((it) => ({...it, id: it.skuId,itemId: it?.item?.id}));
  total.value = res.total;
  loading.value = false;
  resolveItemImages(itemList.value);
}
const handleAddType = (show) => {
  categoryDialog.title = "新增商品分类";
  showParent.value = show
  categoryDialog.visible = true;
  if (show) {
    categoryForm.value.parentId = undefined
  }
  nextTick(() => {
    categoryForm.value.categoryName = undefined;
  });
}
const skuForm = reactive({
  itemSkuList: []
})
const skuFormRef = ref(ElForm)
const skuRules = {
  skuName: [{required: true, message: '规格名称不能为空', trigger: 'blur'}]
}
// sku 管理
const resetItemSkuList = () => {
  skuForm.itemSkuList = []
  skuForm.itemSkuList.push({
    id: '',
    itemId: '',
    barcode: '',
    inPrice: null,
    outPrice: null,
    skuName: '',
    quantity: null,
  })
}

const onAppendBtnClick = () => {
  skuForm.itemSkuList.push({
    id: '',
    itemId: '',
    barcode: '',
    inPrice: null,
    outPrice: null,
    skuName: '',
    quantity: null,
  })
}
const handleDeleteItemSku = async (row, index) => {
  if (!row.id) {
    skuForm.itemSkuList.splice(index, 1);
    return
  }
  if (skuForm.itemSkuList.length === 1) {
    return proxy?.$modal.msgError("至少包含一个商品规格");
  }
  await proxy?.$modal.confirm('确认删除规格【' + row.skuName + '】吗？');
  loading.value = true;
  await delItemSku(row.id).finally(()=> loading.value = false);
  proxy?.$modal.msgSuccess("删除成功");
  const res = await getItem(row.itemId);
  skuForm.itemSkuList = res.data.sku
  form.value = res.data
  dialog.visible = false;
  await getList();
}
const collapse = (draggingNode, dropNode, type) => {
  //注掉的是同级拖拽
  if (draggingNode.data.label !== '全部' && draggingNode.level === dropNode.level && draggingNode.parent.id == dropNode.parent.id) {
    if (dropNode.data.label === '全部') {
      return type === 'next';
    } else {
      return type === 'prev' || type === 'next'
    }
  } else {
    // 不同级进行处理
    return false
  }
}
const handleNodeDrop = async (draggingNode, dropNode, dropType, ev) => {
  if (dropNode.level === 1) {
    await updateOrderNum(dropNode.parent.data.filter(it => it.id !== -1));
  } else {
    await updateOrderNum(dropNode.parent.data.children);
  }
}
/** 取消按钮 */
const cancel = () => {
  reset();
  dialog.visible = false;
}
const cancelType = () => {
  resetType();
  categoryDialog.visible = false;
}
/** 表单重置 */
const reset = () => {
  form.value = {...initFormData};
  itemFormRef.value.resetFields();
}

/** 表单重置 */
const resetType = () => {
  categoryForm.value = {...initCategoryFormData};
  itemCategoryFormRef.value.resetFields();
}
/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
const resetQuery = () => {
  queryFormRef.value.resetFields();
  handleQuery();
}

const selectedRows = ref([])
/** 多选框选中数据 */
const handleSelectionChange = (selection) => {
  ids.value = selection.map(item => item.id);
  selectedRows.value = selection;
  single.value = selection.length != 1;
  multiple.value = !selection.length;
}

/** 新增按钮操作 */
const handleAdd = () => {
  resetItemSkuList()
  dialog.visible = true;
  dialog.title = "新增商品";
  nextTick(async () => {
    reset();
  });
}
/** 修改按钮操作 */
const handleUpdate = (row) => {
  resetItemSkuList()
  skuLoading.value = true
  dialog.visible = true;
  dialog.title = "修改商品";
  nextTick(async () => {
    reset();
    const _id = row?.itemId || ids.value[0]
    const res = await listItemSku({'itemId':_id});
    Object.assign(skuForm.itemSkuList, res.data)
    skuLoading.value = false
    Object.assign(form.value, row.item);
  });
}
const handleQueryType = (node, data) => {
  queryParams.value.pageNum = 1
  if (data.data.label === '全部') {
    queryParams.value.itemCategory = '';
    currentType.value = '';
    getList();
  } else {
    queryParams.value.itemCategory = data.data.id;
    currentType.value = data.data.id;
    getList();
  }
}
/** 提交按钮 */
const submitForm = () => {
  // 将 skuCode 赋值给 barcode
  skuForm.itemSkuList.forEach(sku => {
    if (sku.skuCode) {
      sku.barcode = sku.skuCode;
    }
  });
  form.value.sku = skuForm.itemSkuList
  itemFormRef.value.validate(async (valid) => {
    if (valid) {
      let flag = true
      if (!skuForm.itemSkuList || skuForm.itemSkuList.length === 0) {
        /*proxy?.$modal.msgError("至少包含一个商品规格");
        flag = false*/
        dialog.visible = false;
        await getList();
      }
      await skuFormRef.value.validate((valid2) => {
        if (!valid2) {
          flag = false;
        }
      })
      if (flag) {
        buttonLoading.value = true;
        if (form.value.id) {
          await updateItem(form.value).finally(() => buttonLoading.value = false);
        } else {
          await addItem(form.value).finally(() => buttonLoading.value = false);
        }
        proxy?.$modal.msgSuccess("修改成功");
        dialog.visible = false;
        await getList();
      }
    }
  });
}
const submitCategoryForm = () => {
  itemCategoryFormRef.value.validate(async (valid) => {
    if (valid) {
      buttonLoading.value = true;
      if (categoryForm.value.id) {
        await updateItemCategory(categoryForm.value).finally(() => buttonLoading.value = false);
      } else {
        await addItemCategory(categoryForm.value).finally(() => buttonLoading.value = false);
      }
      proxy?.$modal.msgSuccess(categoryForm.value.id ? '修改成功' : '新增成功');
      categoryDialog.visible = false;
      useWmsStore().getItemCategoryList();
      useWmsStore().getItemCategoryTreeList();
    }
  });
}
/** 删除按钮操作 */
const handleDelete = async (row) => {
  const _ids = row?.itemId || ids.value;
  await proxy?.$modal.confirm('确认删除商品【' + row?.item.itemName + '】吗？');
  loading.value = true;
  await delItem(_ids).finally(()=> loading.value = false);
  proxy?.$modal.msgSuccess("删除成功");
  await getList();
}
const treeRef = ref(null)
const exportLoading = ref(false);
/** 导出按钮操作 */
const handleExport = async () => {
  exportLoading.value = true;
  try {
    const query = { ...queryParams.value, pageNum: 1, pageSize: 99999 };
    const res = await listItemSkuPage(query);
    const rows = res.rows || [];
    if (rows.length === 0) { proxy?.$modal.msgWarning('没有可导出的数据'); return; }

    const store = useWmsStore();
    const getLevelLabel = (val) => {
      const dict = product_level.value?.find(d => d.value === String(val));
      return dict ? dict.label : (val || '');
    };

    const exportData = rows.map(row => ({
      '商品名称': row.item?.itemName || '',
      '商品编号': row.item?.itemCode || '',
      '商品单位': row.item?.unit ? (store.merchantMap.get(row.item.unit)?.merchantName || '') : '',
      '商品分类': row.item?.itemCategory ? (store.itemCategoryMap.get(row.item.itemCategory)?.categoryName || '') : '',
      '商品品牌': row.item?.itemBrand ? (store.itemBrandMap.get(row.item.itemBrand)?.brandName || '') : '',
      '商品级别': getLevelLabel(row.item?.itemLevel),
      '规格名称': row.itemSku?.skuName || '',
      '规格编号': row.itemSku?.skuCode || '',
      '成本价': Number(row.itemSku?.costPrice) || '',
      '销售价': Number(row.itemSku?.sellingPrice) || '',
      '净重(kg)': Number(row.itemSku?.netWeight) || '',
      '毛重(kg)': Number(row.itemSku?.grossWeight) || '',
      '长(cm)': Number(row.itemSku?.length) || '',
      '宽(cm)': Number(row.itemSku?.width) || '',
      '高(cm)': Number(row.itemSku?.height) || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
      { wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '商品列表');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `商品列表_${new Date().getTime()}.xlsx`);
  } catch (e) {
    proxy?.$modal.msgError('导出失败：' + (e.message || e));
  } finally {
    exportLoading.value = false;
  }
}

// 确认批量下载
const confirmBatchDownload = async () => {
  if (batchDownloadDialog.startNum > batchDownloadDialog.endNum) {
    proxy?.$modal.msgError('起始编号不能大于结束编号');
    return;
  }

  if (batchDownloadDialog.endNum - batchDownloadDialog.startNum + 1 > 9999) {
    proxy?.$modal.msgError('一次性最多生成9999个码');
    return;
  }

  batchDownloadDialog.loading = true;

  try {
    const zip = new JSZip();
    const count = batchDownloadDialog.endNum - batchDownloadDialog.startNum + 1;

    for (let i = batchDownloadDialog.startNum; i <= batchDownloadDialog.endNum; i++) {
      // 码值直接使用商品编号，不添加后缀
      const codeValue = batchDownloadDialog.itemCode;

      let blob;
      if (batchDownloadDialog.type === 'barcode') {
        blob = await generateBarcodeBlob(codeValue);
      } else {
        blob = await generateQrcodeBlob(codeValue);
      }

      const fileName = batchDownloadDialog.startNum === batchDownloadDialog.endNum
        ? `${codeValue}.png`
        : `${codeValue}_${i}.png`;
      zip.file(fileName, blob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const zipFileName = `${batchDownloadDialog.type === 'barcode' ? '条码' : '二维码'}_${batchDownloadDialog.itemCode}_${new Date().getTime()}.zip`;
    saveAs(content, zipFileName);

    proxy?.$modal.msgSuccess(`成功生成 ${count} 个${batchDownloadDialog.type === 'barcode' ? '条码' : '二维码'}`);
    batchDownloadDialog.visible = false;
  } catch (error) {
    console.error('生成失败:', error);
    proxy?.$modal.msgError('生成失败，请重试');
  } finally {
    batchDownloadDialog.loading = false;
  }
}

// 生成单个条码的 Blob
const generateBarcodeBlob = (codeValue) => {
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
const generateQrcodeBlob = (codeValue) => {
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


/** 批量下载条码（勾选商品） */
const handleBatchDownloadBarcode = async () => {
  if (selectedRows.value.length === 0) return;
  const rows = selectedRows.value.filter(r => r.itemSku?.skuCode);
  if (rows.length === 0) {
    proxy?.$modal.msgWarning('选中的商品均无规格编号，无法生成条码');
    return;
  }
  const zip = new JSZip();
  for (const r of rows) {
    const codeValue = r.itemSku.skuCode;
    const blob = await generateBarcodeBlob(codeValue);
    zip.file(`${codeValue}.png`, blob);
  }
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `条码_${rows.length}个商品.zip`);
}

/** 批量下载二维码（勾选商品） */
const handleBatchDownloadQrcode = async () => {
  if (selectedRows.value.length === 0) return;
  const rows = selectedRows.value.filter(r => r.itemSku?.skuCode);
  if (rows.length === 0) {
    proxy?.$modal.msgWarning('选中的商品均无规格编号，无法生成二维码');
    return;
  }
  const zip = new JSZip();
  for (const r of rows) {
    const codeValue = r.itemSku.skuCode;
    const blob = await generateQrcodeBlob(codeValue);
    zip.file(`${codeValue}.png`, blob);
  }
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `二维码_${rows.length}个商品.zip`);
}


/** 下载商品码（批量） */
const handleDownloadProductCode = async () => {
  if (selectedRows.value.length === 0) return;
  const rows = selectedRows.value.filter(r => r.item?.itemCode);
  if (rows.length === 0) {
    proxy?.$modal.msgWarning('选中的商品均无商品编号，无法生成商品码');
    return;
  }

  try {
    if (rows.length === 1) {
      const r = rows[0];
      const blob = await generateProductCodeBlob({
        itemName: r.item?.itemName || '',
        skuName: r.itemSku?.skuName || '',
        itemCode: r.item?.itemCode || ''
      });
      saveAs(blob, `商品码_${r.item.itemCode}.png`);
    } else {
      const zip = new JSZip();
      for (const r of rows) {
        const blob = await generateProductCodeBlob({
          itemName: r.item?.itemName || '',
          skuName: r.itemSku?.skuName || '',
          itemCode: r.item?.itemCode || ''
        });
        zip.file(`商品码_${r.item.itemCode}.png`, blob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `商品码_批量_${new Date().getTime()}.zip`);
    }
    proxy?.$modal.msgSuccess(`成功生成 ${rows.length} 个商品码`);
  } catch (error) {
    console.error('生成商品码失败:', error);
    proxy?.$modal.msgError('生成商品码失败');
  }
};

/** 生成商品码卡片图片（60mm×40mm @300DPI） */
const generateProductCodeBlob = ({ itemName, skuName, itemCode }) => {
  return new Promise((resolve, reject) => {
    try {
      // 60mm × 40mm @ 300DPI（横向卡片）
      const W = 709;
      const H = 472;
      const PAD = 25; // 上下左右留白
      const LABEL_W = 106;
      const ROW_H = 80;          // ← Name/Model/Code 行高（调大则数据行更高）
      const TITLE_H = 50;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      // 白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // 外边框（留白内）
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 3;
      ctx.strokeRect(PAD, PAD, W - PAD * 2, H - PAD * 2);

      // 标题
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Stock Card', W / 2, PAD + TITLE_H / 2);

      // 标题下分隔线
      const titleBottom = PAD + TITLE_H;
      ctx.beginPath();
      ctx.moveTo(PAD, titleBottom);
      ctx.lineTo(W - PAD, titleBottom);
      ctx.stroke();

      // 数据行
      const dataRows = [
        { label: 'Name', value: itemName },
        { label: 'Model', value: skuName },
        { label: 'Code', value: itemCode },
      ];

      let y = titleBottom;
      dataRows.forEach((row) => {
        y += ROW_H;
        ctx.beginPath();
        ctx.moveTo(PAD, y);
        ctx.lineTo(W - PAD, y);
        ctx.stroke();

        // 左侧标签背景
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(PAD + 1, y - ROW_H + 1, LABEL_W - 1, ROW_H - 1);

        ctx.beginPath();
        ctx.moveTo(PAD + LABEL_W, y - ROW_H);
        ctx.lineTo(PAD + LABEL_W, y);
        ctx.stroke();

        ctx.fillStyle = '#333333';
        ctx.font = 'bold 15px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(row.label, PAD + LABEL_W / 2, y - ROW_H / 2);

        ctx.fillStyle = '#000000';
        ctx.font = '15px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(row.value || '', PAD + LABEL_W + 12, y - ROW_H / 2);
      });

      // Barcode 行（填满剩余全部空间，条码图居中显示）
      const barcodeStartY = y;
      const barcodeRowH = H - PAD - barcodeStartY; // 填满到底部边框
      const barcodeEndY = H - PAD;
      const BARCODE_IMG_H = 110;  // ← 条码图实际高度（调小则条码更矮）

      ctx.beginPath();
      ctx.moveTo(PAD, barcodeStartY);
      ctx.lineTo(W - PAD, barcodeStartY);
      ctx.stroke();

      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(PAD + 1, barcodeStartY + 1, LABEL_W - 1, barcodeRowH - 1);
      ctx.beginPath();
      ctx.moveTo(PAD + LABEL_W, barcodeStartY);
      ctx.lineTo(PAD + LABEL_W, barcodeEndY);
      ctx.stroke();

      ctx.fillStyle = '#333333';
      ctx.font = 'bold 15px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Barcode', PAD + LABEL_W / 2, barcodeStartY + barcodeRowH / 2);

      // 绘制条形码（居中显示）
      if (itemCode) {
        try {
          const barcodeCanvas = document.createElement('canvas');
          JSBarcode(barcodeCanvas, itemCode, {
            format: 'CODE128',
            displayValue: false,
            height: BARCODE_IMG_H,
            margin: 0,
            background: '#ffffff',
            lineColor: '#000000'
          });
          // 条码图水平居中、垂直居中
          const cellLeft = PAD + LABEL_W;
          const cellWidth = W - PAD - cellLeft;
          const bw = cellWidth - 20; // 左右各留10px内边距
          const bh = BARCODE_IMG_H;
          const bx = cellLeft + (cellWidth - bw) / 2;
          const by = barcodeStartY + (barcodeRowH - bh) / 2;
          ctx.drawImage(barcodeCanvas, bx, by, bw, bh);
        } catch (e) {
          ctx.fillStyle = '#000';
          ctx.font = '15px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(itemCode, PAD + LABEL_W + (W - PAD - LABEL_W) / 2, barcodeStartY + barcodeRowH / 2);
        }
      }

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('生成商品码失败'));
      }, 'image/png');
    } catch (error) {
      reject(error);
    }
  });
};

/** 下载条形码 */
const downloadBarcode = (row) => {
  if (!row.itemSku.skuCode) {
    proxy?.$modal.msgWarning('该规格没有设置条码');
    return;
  }

  try {
    const canvas = document.createElement('canvas');
    JSBarcode(canvas, row.itemSku.skuCode, {
      format: "CODE128",
      displayValue: true,
      fontSize: 16,
      height: 100,
      margin: 10,
      background: "#ffffff",
      lineColor: "#000000"
    });

    const a = document.createElement('a');
    a.download = `条码_${row.itemSku.skuCode}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();

    proxy?.$modal.msgSuccess('条码下载成功');
  } catch (error) {
    console.error('生成条码失败:', error);
    proxy?.$modal.msgError('生成条码失败');
  }
}

/** 下载二维码 */
const downloadQrcode = async (row) => {
  if (!row.itemSku.skuCode) {
    proxy?.$modal.msgWarning('该规格没有设置条码');
    return;
  }

  try {
    const qrCodeUrl = await Qrcode.toDataURL(row.itemSku.skuCode, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    const a = document.createElement('a');
    a.download = `二维码_${row.itemSku.skuCode}.png`;
    a.href = qrCodeUrl;
    a.click();

    proxy?.$modal.msgSuccess('二维码下载成功');
  } catch (error) {
    console.error('生成二维码失败:', error);
    proxy?.$modal.msgError('生成二维码失败');
  }
}

const getVolumeText = (itemSku) => {
  if((itemSku.length || itemSku.length === 0) && (itemSku.width || itemSku.width === 0) && (itemSku.height || itemSku.height === 0)) {
    return itemSku.length + ' * ' + itemSku.width + ' * ' + itemSku.height
  }
  return ((itemSku.length || itemSku.length === 0) ? ('长：' + itemSku.length) : '')
    + ((itemSku.width || itemSku.width === 0) ? (' 宽：' + itemSku.width) : '')
    + ((itemSku.height || itemSku.height === 0) ? (' 高：' + itemSku.height) : '')
}
onMounted(() => {
  nextTick(()=>{
    getList();
    useWmsStore().getMerchantList();
    if (route.query.openDrawer) {
      handleAdd()
    }
  })
});
</script>
<style>
.custom-tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  padding-right: 8px;
}

.el-tree-node__content {
  display: flex;
  align-items: center;
  height: 35px;
  cursor: pointer;
}

.el-table .my-cell {
  vertical-align: top
}

.el-table__empty-text {
  width: 100%;
}

</style>
