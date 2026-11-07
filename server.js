const express=require("express");
const session=require("express-session");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const app=express(),PORT=process.env.PORT||3000;
app.set("trust proxy",1);
const DB=path.join(__dirname,"store-data.json");
const seed=[
{id:"a1",name:"Wireless Headphones",category:"Electronics",price:1299,oldPrice:1799,stock:20,image:"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",description:"Wireless audio for everyday listening.",active:true},
{id:"a2",name:"Smart Watch",category:"Electronics",price:1799,oldPrice:2499,stock:15,image:"https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",description:"A smart everyday accessory.",active:true},
{id:"a3",name:"Bluetooth Speaker",category:"Electronics",price:999,oldPrice:1499,stock:25,image:"https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80",description:"Compact speaker for home and travel.",active:true},
{id:"a4",name:"Charging Cable",category:"Accessories",price:199,oldPrice:299,stock:50,image:"https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80",description:"Everyday charging accessory.",active:true}
];
let pool=process.env.DATABASE_URL?new (require("pg").Pool)({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==="true"?{rejectUnauthorized:false}:undefined,max:5}):null,db={products:seed,orders:[],customers:[]};
function saveFile(){fs.writeFileSync(DB,JSON.stringify(db,null,2));}
async function save(){
 if(pool){
  const c=await pool.connect();
  try{
   await c.query("BEGIN");
   await c.query("DELETE FROM solotech_products");
   for(const p of db.products) await c.query("INSERT INTO solotech_products(id,data) VALUES($1,$2::jsonb)",[p.id,JSON.stringify(p)]);
   await c.query("DELETE FROM solotech_orders");
   for(const o of db.orders) await c.query("INSERT INTO solotech_orders(id,data) VALUES($1,$2::jsonb)",[o.id,JSON.stringify(o)]);
   await c.query("DELETE FROM solotech_customers");
   for(const u of db.customers) await c.query("INSERT INTO solotech_customers(id,data) VALUES($1,$2::jsonb)",[u.id,JSON.stringify(u)]);
   await c.query("COMMIT");
  }catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
 }else saveFile();
}

const budgetCatalog={
 "Mobiles": ["Basic Keypad Mobile","Compact Feature Phone","Dual SIM Keypad Phone","Long Battery Feature Phone","Torch Feature Phone","FM Radio Mobile","Large Button Mobile","Entry Level Keypad Phone","Mini Feature Phone","Everyday Keypad Phone"],
 "Electronics": ["USB LED Light","Mini Bluetooth Speaker","Wired Earphones","USB Desk Fan","Digital Alarm Clock","LED Night Lamp","Mini Torch","USB Reading Light","Portable FM Radio","Basic Wired Mouse"],
 "Accessories": ["Phone Stand","USB Type-C Cable","Micro USB Cable","Screen Guard","Back Cover","Cable Protector","Earphone Case","Laptop Sleeve","OTG Adapter","Pop Socket Grip"],
 "Fashion": ["Cotton T-Shirt","Casual Cap","Everyday Socks Pack","Canvas Belt","Cotton Handkerchief Set","Simple Wallet","Hair Band Set","Basic Sunglasses","Daily Use Scarf","Casual Tote Bag"],
 "Home & Kitchen": ["Steel Water Bottle","Kitchen Storage Box","Lunch Box","Measuring Spoon Set","Vegetable Peeler","Dish Rack","Cleaning Brush Set","Cotton Kitchen Towel","Reusable Food Container","Manual Hand Chopper"],
 "Appliances": ["Mini USB Fan","LED Emergency Light","Electric Kettle","Hand Blender","Rechargeable Torch","Extension Board","Electric Lunch Box","Mini Sewing Machine","Mosquito Bat","Digital Weighing Scale"],
 "Beauty": ["Comb Set","Makeup Pouch","Nail Cutter Set","Face Towel Set","Hair Brush","Cosmetic Mirror","Travel Bottle Set","Makeup Sponge Set","Headband Set","Manicure Kit"]
};
const budgetVariants=["Value Pack","Classic","Daily Use","Compact","Saver Edition"];
const budgetImages={
 "Mobiles":"https://images.ctfassets.net/wcfotm6rrl7u/7JV2RmHVF4YDCAb1wunqZo/f11af8b643d5db4b1975d92377dffad6/Nokia_110-2024-Black-FrontBack-Int.png?fit=pad&h=753&q=88&w=753",
 "Electronics":"https://prcdn.freetls.fastly.net/release_image/2319/676/2319-676-ac59c260c4901235c9480e019fe70261-1080x1080.jpg?auto=webp&bg-color=fff&fit=bounds&format=jpeg&height=1350&quality=85%2C65&width=1950",
 "Accessories":"https://sotovikm.ru/images/abt__ut2/banners/all/129/category_02_mobile_accessories.png",
 "Fashion":"https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=900&q=80",
 "Home & Kitchen":"https://www.gefu.com/media/3a/7d/7f/1686146846/12735-gefu-lunchbox-endure-gross-02.jpg",
 "Appliances":"https://www.abc.cl/dw/image/v2/BCPP_PRD/on/demandware.static/-/Sites-master-catalog/default/dw91433186/images/large/29907.jpg?sh=400&sm=cut&sw=400",
 "Beauty":"https://eveen.pk/cdn/shop/files/M11_b353bca7-5986-49d5-ad23-0b40db458996.jpg?crop=center&height=1500&v=1714152371&width=1500"
};
const productImages={
 "Basic Keypad Mobile":"https://img-prd-pim.poorvika.com/cdn-cgi/image/width%3D500%2Cheight%3D500%2Cquality%3D75/product/nokia-110-dual-sim-black-02.png",
 "Compact Feature Phone":"https://s3b.cashify.in/gpro/uploads/2023/10/13135802/jio-bharat-b1-front.webp",
 "Dual SIM Keypad Phone":"https://www.triveniworld.com/cdn/shop/files/easyfone-udaan2-1-8-display-with-20-senior-citizen-friendly-features-like-loud-sound-photo-speed-dial-simple-menu-sos-incoming-call-restriction-auto-call-recording-dual-sim-white-triveni-world-8.jpg?v=1736054845",
 "USB LED Light":"https://rukminim2.flixcart.com/image/960/1280/jtq47m80/usb-gadget/4/g/m/flexible-portable-usb-flipkart-smartbuy-original-imafezbgrdecmnjh.jpeg?q=60",
 "Mini Bluetooth Speaker":"https://instamart-media-assets.swiggy.com/swiggy/image/upload/fl_lossy%2Cf_auto%2Cq_auto%2Cw_1200%2Ch_630/NI_CATALOG/IMAGES/ciw/2026/2/20/af44b82e-6b75-4db3-bb71-221a2cf5850a_BY9YU0F12X_MN_20022026.png",
 "Wired Earphones":"https://www.addmecart.com/uploads/71107700807464_1_WE6.jpg",
 "USB Desk Fan":"https://kitchenmart.co.in/cdn/shop/files/71t9IkMhoTL_2000x.jpg?v=1746271829",
 "Digital Alarm Clock":"https://www.portronics.com/cdn/shop/files/Artboard1_0f8d3832-270a-44c3-9f4a-022e5d577b9a.jpg?v=1773905917",
 "Phone Stand":"https://coconutcases.com/cdn/shop/files/01_6586b755-fcce-484f-9325-b9d9620d360a.jpg?v=1771246544",
 "Screen Guard":"https://coconutcases.com/cdn/shop/files/01_6586b755-fcce-484f-9325-b9d9620d360a.jpg?v=1771246544",
 "Back Cover":"https://coconutcases.com/cdn/shop/files/01_6586b755-fcce-484f-9325-b9d9620d360a.jpg?v=1771246544",
 "Cable Protector":"https://coconutcases.com/cdn/shop/files/01_6586b755-fcce-484f-9325-b9d9620d360a.jpg?v=1771246544",
 "Casual Cap":"https://images.meesho.com/images/products/297433774/d56hs_512.jpg",
 "Simple Wallet":"https://images.meesho.com/images/products/297433774/d56hs_512.jpg",
 "Canvas Belt":"https://images.meesho.com/images/products/297433774/d56hs_512.jpg",
 "Basic Sunglasses":"https://images.meesho.com/images/products/297433774/d56hs_512.jpg",
 "Lunch Box":"https://www.schooluniformshop.in/cdn/shop/collections/generate-an-image-having-cello-and-milton-products.png?v=1771320211",
 "Steel Water Bottle":"https://www.schooluniformshop.in/cdn/shop/collections/generate-an-image-having-cello-and-milton-products.png?v=1771320211",
 "Electric Kettle":"https://cdn.moglix.com/p/fb6oeNbCviEq7-xxlarge.jpg",
 "Hand Blender":"https://m.media-amazon.com/images/I/51oOm-nHGKL._SL500_.jpg",
 "Manual Hand Chopper":"https://m.media-amazon.com/images/I/51oOm-nHGKL._SL500_.jpg",
 "Manicure Kit":"https://laz-img-sg.alicdn.com/p/ce77d78d93b352373d2b809c3e881ae7.jpg"
};
const reliableCategoryImages={
 "Mobiles":"https://img-prd-pim.poorvika.com/cdn-cgi/image/width%3D500%2Cheight%3D500%2Cquality%3D75/product/nokia-110-dual-sim-black-02.png",
 "Electronics":"https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80",
 "Accessories":"https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80",
 "Fashion":"https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=900&q=80",
 "Home & Kitchen":"https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80",
 "Appliances":"https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=900&q=80",
 "Beauty":"https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80"
};
function budgetImageFor(category,base){return productImages[base]||reliableCategoryImages[category]||"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80";}
function ensureBudgetCatalog(){
 const existing=new Set(db.products.map(p=>p.id));
 for(const [category,names] of Object.entries(budgetCatalog)){
  names.forEach((base,i)=>budgetVariants.forEach((variant,j)=>{
   const id="budget-"+category.toLowerCase().replace(/[^a-z]+/g,"-")+"-"+String(i*5+j+1).padStart(2,"0");
   if(existing.has(id))return;
   let price;
   if(category==="Mobiles")price=999+((i*173+j*97)%1000);
   else if(category==="Appliances")price=149+((i*83+j*47)%650);
   else price=49+((i*37+j*29)%450);
   db.products.push({id,name:base+" - "+variant,category,price,oldPrice:Math.round(price*1.3),stock:20,image:budgetImageFor(category,base),description:"Affordable budget pick for everyday use. Cash on Delivery available.",active:true});
   existing.add(id);
  }));
 }
}

function refreshCatalogImages(){
 const seeded=new Set(["a1","a2","a3","a4"]);
 for(const p of db.products){
  if(p.id.startsWith("budget-")){
   const base=String(p.name||"").replace(/ - (Value Pack|Classic|Daily Use|Compact|Saver Edition)$/,"");
   p.image=budgetImageFor(p.category,base);
  }else if(seeded.has(p.id)){
   const images={a1:"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",a2:"https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",a3:"https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80",a4:"https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80"};
   p.image=images[p.id];
  }
 }
}
