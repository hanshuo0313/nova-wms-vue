import request from '@/utils/request'

// 查询术语词典列表
export function listGlossary(query) {
  return request({
    url: '/wms/glossary/list',
    method: 'get',
    params: query
  })
}

export function getEnabled(targetLang) {
  return request({
    url: '/wms/glossary/enabled',
    method: 'get',
    params: { targetLang }
  })
}

// 查询术语词典详细
export function getGlossary(id) {
  return request({
    url: '/wms/glossary/' + id,
    method: 'get'
  })
}

// 新增术语词典
export function addGlossary(data) {
  return request({
    url: '/wms/glossary',
    method: 'post',
    data: data
  })
}

// 修改术语词典
export function updateGlossary(data) {
  return request({
    url: '/wms/glossary',
    method: 'put',
    data: data
  })
}

// 删除术语词典
export function delGlossary(id) {
  return request({
    url: '/wms/glossary/' + id,
    method: 'delete'
  })
}
