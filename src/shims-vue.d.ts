/* eslint-disable */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  declare module 'js-md5'

  export default component
}
declare module "*.json" {
  const value: any;
  export default value;
}