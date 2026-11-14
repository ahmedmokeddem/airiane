const {validateProductionMobile}=require('./production-config.cjs');
module.exports=({config})=>{validateProductionMobile(process.env);return config;};
