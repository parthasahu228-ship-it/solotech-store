const express=require("express");
const session=require("express-session");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const app=express(),PORT=process.env.PORT||3000;
app.set("trust proxy",1);app.disable("x-powered-by");
app.use((q,s,n)=>{s.setHeader("X-Content-Type-Options","nosniff");s.setHeader("X-Frame-Options","DENY");s.setHeader("Referrer-Policy","strict-origin-when-cross-origin");s.setHeader("Permissions-Policy","camera=(),microphone=(),geolocation=()");n();});
const DB=path.join(__dirname,"store-data.json");
const seed=[
{id:"a1",name:"Wireless Headphones",category:"Electronics",price:1299,oldPrice:1799,stock:20,image:"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",description:"Wireless audio for everyday listening.",active:true},
{id:"a2",name:"Smart Watch",category:"Electronics",price:1799,oldPrice:2499,stock:15,image:"https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",description:"A smart everyday accessory.",active:true},
{id:"a3",name:"Bluetooth Speaker",category:"Electronics",price:999,oldPrice:1499,stock:25,image:"https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80",description:"Compact speaker for home and travel.",active:true},
{id:"a4",name:"Charging Cable",category:"Accessories",price:199,oldPrice:299,stock:50,image:"https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80",description:"Everyday charging accessory.",active:true}
];
let pool=process.env.DATABASE_URL?new (require("pg").Pool)({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==="true"?{rejectUnauthorized:false}:undefined,max:5}):null,db={products:seed,orders:[],customers:[]};
function saveFile(){fs.writeFileSync(DB,JSON.stringify(db,null,2));}
function dedupeById(items){const map=new Map();for(const item of (Array.isArray(items)?items:[])){if(item&&item.id!==undefined&&item.id!==null)map.set(String(item.id),item);}return [...map.values()];}
let saveQueue=Promise.resolve();
function save(){
 saveQueue=saveQueue.then(async()=>{
 db.products=dedupeById(db.products);db.orders=dedupeById(db.orders);db.customers=dedupeById(db.customers);
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
 });
 return saveQueue;
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

async function init(){
 db.customers=db.customers||[];
 if(process.env.DATABASE_URL){
  await pool.query("CREATE TABLE IF NOT EXISTS solotech_products(id text PRIMARY KEY,data jsonb NOT NULL)");
  await pool.query("CREATE TABLE IF NOT EXISTS solotech_orders(id text PRIMARY KEY,data jsonb NOT NULL)");
  await pool.query("CREATE TABLE IF NOT EXISTS solotech_customers(id text PRIMARY KEY,data jsonb NOT NULL)");
  const p=await pool.query("SELECT data FROM solotech_products ORDER BY id");
  const o=await pool.query("SELECT data FROM solotech_orders ORDER BY id");
  const u=await pool.query("SELECT data FROM solotech_customers ORDER BY id");
  if(p.rows.length) db.products=p.rows.map(x=>x.data);
  else {
   if(fs.existsSync(DB)){try{const old=JSON.parse(fs.readFileSync(DB));if(Array.isArray(old.products))db.products=old.products;if(Array.isArray(old.orders))db.orders=old.orders;}catch{}}
   await save();
  }
  db.orders=o.rows.map(x=>x.data);
  db.customers=u.rows.map(x=>x.data);
  if(!o.rows.length && fs.existsSync(DB)){try{const old=JSON.parse(fs.readFileSync(DB));if(Array.isArray(old.orders))db.orders=old.orders;}catch{};if(db.orders.length)await save();}
  console.log("SOLOTECH database connected");
 }else{
  if(fs.existsSync(DB)){try{db=JSON.parse(fs.readFileSync(DB));}catch{saveFile();}}
  else saveFile();
  db.products=Array.isArray(db.products)?db.products:seed;
  db.orders=Array.isArray(db.orders)?db.orders:[];
  db.customers=Array.isArray(db.customers)?db.customers:[];
  console.log("SOLOTECH running with local file storage; DATABASE_URL is not set");
 }
}
app.use(express.json({limit:"1mb"}));
const rateBuckets=new Map();
function rateLimit(key,limit,windowMs){return(q,s,n)=>{const now=Date.now(),k=key+":"+(q.ip||"unknown"),v=rateBuckets.get(k)||{count:0,start:now};if(now-v.start>windowMs){v.count=0;v.start=now;}v.count++;rateBuckets.set(k,v);if(v.count>limit){s.setHeader("Retry-After",String(Math.ceil((windowMs-(now-v.start))/1000)));return s.status(429).json({error:"Too many attempts. Please wait a little and try again."});}n();};}
const loginLimit=rateLimit("customer-login",10,15*60*1000),signupLimit=rateLimit("customer-signup",5,60*60*1000),adminLoginLimit=rateLimit("admin-login",5,15*60*1000);
const sessionOptions={name:"solotech.sid",secret:process.env.SESSION_SECRET||"replace-this-secret",resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:"lax",secure:"auto",maxAge:8*60*60*1000}};
if(process.env.DATABASE_URL){
 const PgSession=require("connect-pg-simple")(session);
 sessionOptions.store=new PgSession({pool,createTableIfMissing:true,tableName:"solotech_sessions"});
}
app.use(session(sessionOptions));
app.get("/robots.txt",(q,s)=>s.type("text/plain").send("User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /api/\nSitemap: https://solotech-store.onrender.com/sitemap.xml\n"));
app.get("/sitemap.xml",(q,s)=>s.type("application/xml").send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://solotech-store.onrender.com/</loc><changefreq>daily</changefreq><priority>1.0</priority></url></urlset>'));
app.use(express.static(path.join(__dirname,"public")));
const auth=(q,s,n)=>q.session?.admin?n():s.status(401).json({error:"Admin login required"});
app.get("/api/health",(q,s)=>s.json({ok:true,storage:pool?"postgres":"local"}));

const customerAuth=(q,s,n)=>q.session?.customerId?n():s.status(401).json({error:"Please login to your customer account."});
const hashPassword=p=>{const salt=crypto.randomBytes(16).toString("hex");return salt+":"+crypto.scryptSync(String(p),salt,64).toString("hex");};
const checkPassword=(p,h)=>{try{const [salt,key]=h.split(":");const a=crypto.scryptSync(String(p),salt,64),b=Buffer.from(key,"hex");return b.length===a.length&&crypto.timingSafeEqual(a,b);}catch{return false;}};
const publicCustomer=u=>({id:u.id,name:u.name,phone:u.phone,email:u.email||"",addresses:u.addresses||[],wishlist:u.wishlist||[],cart:u.cart||[]});
const startCustomerSession=(q,s,u,status=200)=>q.session.regenerate(err=>{if(err){console.error("Customer session regenerate failed:",err);return s.status(500).json({error:"Login session could not be started. Please try again."});}q.session.customerId=u.id;q.session.save(err=>{if(err){console.error("Customer session save failed:",err);return s.status(500).json({error:"Login session could not be saved. Please try again."});}s.status(status).json({ok:true,customer:publicCustomer(u)});});});
app.post("/api/customer/signup",signupLimit,async(q,s)=>{try{const b=q.body||{},phone=String(b.phone||"").replace(/\s+/g,"");if(!String(b.name||"").trim()||!/^[6-9]\d{9}$/.test(phone)||String(b.password||"").length<6)return s.status(400).json({error:"Enter your name, valid 10-digit mobile number and password (minimum 6 characters)."});if(db.customers.some(u=>String(u.phone).replace(/\s+/g,"")===phone))return s.status(409).json({error:"This mobile number already has an account. Please login."});const u={id:"CU"+Date.now()+crypto.randomBytes(3).toString("hex"),name:String(b.name).trim(),phone,email:String(b.email||"").trim(),passwordHash:hashPassword(b.password),addresses:[],wishlist:[],cart:[],createdAt:new Date().toISOString()};db.customers.push(u);await save();startCustomerSession(q,s,u,201);}catch(e){console.error(e);s.status(500).json({error:"Could not create account. Please try again."});}});
app.post("/api/customer/login",loginLimit,(q,s)=>{const phone=String(q.body?.phone||"").replace(/\s+/g,""),u=db.customers.find(x=>String(x.phone||"").replace(/\s+/g,"")===phone);if(!u||!u.passwordHash||!checkPassword(q.body?.password||"",u.passwordHash))return s.status(401).json({error:"Mobile number or password is incorrect. Use the same password you entered when creating your SOLOTECH account."});startCustomerSession(q,s,u);});
app.post("/api/customer/logout",(q,s)=>q.session.destroy(err=>err?s.status(500).json({error:"Could not log out. Please try again."}):s.json({ok:true})));
app.get("/api/customer/me",customerAuth,(q,s)=>{const u=db.customers.find(x=>x.id===q.session.customerId);if(!u){delete q.session.customerId;return s.status(401).json({error:"Please login."});}s.json({customer:publicCustomer(u)});});
app.put("/api/customer/profile",customerAuth,async(q,s)=>{try{const u=db.customers.find(x=>x.id===q.session.customerId),b=q.body||{};if(!u)return s.sendStatus(401);if(!b.name||!/^[6-9]\d{9}$/.test(String(b.phone||"")))return s.status(400).json({error:"Enter a name and valid 10-digit mobile number."});if(db.customers.some(x=>x.id!==u.id&&x.phone===String(b.phone)))return s.status(409).json({error:"This mobile number is already used by another account."});u.name=String(b.name).trim();u.phone=String(b.phone);u.email=String(b.email||"").trim();if(b.newPassword){if(String(b.newPassword).length<6)return s.status(400).json({error:"New password must be at least 6 characters."});if(!checkPassword(b.currentPassword||"",u.passwordHash))return s.status(400).json({error:"Current password is incorrect."});u.passwordHash=hashPassword(b.newPassword);}await save();s.json({ok:true,customer:publicCustomer(u)});}catch(e){console.error(e);s.status(500).json({error:"Could not update profile."});}});
app.post("/api/customer/addresses",customerAuth,async(q,s)=>{const u=db.customers.find(x=>x.id===q.session.customerId),b=q.body||{};if(!u)return s.sendStatus(401);if(!b.label||!b.name||!/^[6-9]\d{9}$/.test(String(b.phone||""))||!b.address||!b.city||!b.state||!/^[0-9]{6}$/.test(String(b.pin||"")))return s.status(400).json({error:"Please complete all address details correctly."});const a={id:"AD"+Date.now()+crypto.randomBytes(2).toString("hex"),label:String(b.label),name:String(b.name),phone:String(b.phone),address:String(b.address),city:String(b.city),state:String(b.state),pin:String(b.pin)};u.addresses=u.addresses||[];u.addresses.push(a);try{await save();s.status(201).json({ok:true,addresses:u.addresses});}catch(e){console.error(e);s.sendStatus(500);}});
app.delete("/api/customer/addresses/:id",customerAuth,async(q,s)=>{const u=db.customers.find(x=>x.id===q.session.customerId);if(!u)return s.sendStatus(401);u.addresses=(u.addresses||[]).filter(a=>a.id!==q.params.id);await save();s.json({ok:true,addresses:u.addresses});});
app.get("/api/customer/wishlist",customerAuth,(q,s)=>{const u=db.customers.find(x=>x.id===q.session.customerId);s.json(u?.wishlist||[]);});
app.post("/api/customer/wishlist/:id",customerAuth,async(q,s)=>{const u=db.customers.find(x=>x.id===q.session.customerId),p=db.products.find(x=>x.id===q.params.id&&x.active);if(!u||!p)return s.sendStatus(404);u.wishlist=u.wishlist||[];if(!u.wishlist.includes(p.id))u.wishlist.push(p.id);await save();s.json({ok:true,wishlist:u.wishlist});});
app.delete("/api/customer/wishlist/:id",customerAuth,async(q,s)=>{const u=db.customers.find(x=>x.id===q.session.customerId);if(!u)return s.status(401).json({error:"Please login."});u.wishlist=(u.wishlist||[]).filter(id=>id!==q.params.id);await save();s.json({ok:true,wishlist:u.wishlist});});
app.get("/api/customer/cart",customerAuth,(q,s)=>{const u=db.customers.find(x=>x.id===q.session.customerId);s.json(u?.cart||[]);});
app.put("/api/customer/cart",customerAuth,async(q,s)=>{const u=db.customers.find(x=>x.id===q.session.customerId);if(!u)return s.sendStatus(401);u.cart=Array.isArray(q.body?.items)?q.body.items.filter(i=>db.products.some(p=>p.id===i.id&&p.active)).map(i=>({id:i.id,qty:Math.max(1,Math.min(10,Number(i.qty)||1))})):[];await save();s.json({ok:true,cart:u.cart});});
app.get("/api/customer/orders",customerAuth,(q,s)=>s.json(db.orders.filter(o=>o.customerId===q.session.customerId)));
app.patch("/api/customer/orders/:id/cancel",customerAuth,async(q,s)=>{try{const o=db.orders.find(x=>x.id===q.params.id&&x.customerId===q.session.customerId);if(!o)return s.sendStatus(404);if(!["New","Confirmed"].includes(o.status))return s.status(409).json({error:"This order can no longer be cancelled online. Please contact the store."});o.status="Cancelled";for(const i of o.items||[]){const p=db.products.find(x=>x.id===i.id);if(p)p.stock=Number(p.stock||0)+Number(i.qty||0);}await save();s.json({ok:true,order:o});}catch(e){console.error(e);s.status(500).json({error:"Could not cancel order."});}});

app.get("/api/products",(q,s)=>s.json(db.products.filter(p=>p.active)));
app.post("/api/orders",async(q,s)=>{try{
 const b=q.body||{};
 if(!b.name||!/^[6-9]\d{9}$/.test(String(b.phone||""))||!b.address||!b.city||!b.state||!/^[0-9]{6}$/.test(String(b.pin||""))||!Array.isArray(b.items)||!b.items.length)return s.status(400).json({error:"Please enter all delivery details correctly."});
 const quantities=new Map();
 for(const x of b.items){if(!x||typeof x.id!=="string")return s.status(400).json({error:"Invalid cart item."});const qty=Number(x.qty);if(!Number.isInteger(qty)||qty<1||qty>10)return s.status(400).json({error:"Quantity must be between 1 and 10."});quantities.set(x.id,(quantities.get(x.id)||0)+qty);}
 let items=[],total=0;
 for(const [id,qty] of quantities){const p=db.products.find(y=>y.id===id&&y.active);if(!p||!Number.isFinite(Number(p.price))||qty>10||Number(p.stock)<qty)return s.status(400).json({error:"Product stock unavailable or quantity invalid. Refresh your cart."});items.push({id:p.id,name:p.name,price:Number(p.price),qty});total+=Number(p.price)*qty;}
 for(const i of items)db.products.find(p=>p.id===i.id).stock-=i.qty;
 const order={id:"ST"+Date.now(),customerId:q.session?.customerId||null,name:b.name,phone:String(b.phone),address:b.address,city:b.city,state:b.state,pin:String(b.pin),items,total,payment:"Cash on Delivery",status:"New",createdAt:new Date().toISOString()};
 db.orders.unshift(order);if(q.session?.customerId){const u=db.customers.find(x=>x.id===q.session.customerId);if(u)u.cart=[];}await save();s.status(201).json({ok:true,orderId:order.id});
 }catch(e){console.error(e);s.status(500).json({error:"Could not save order. Please try again."});}});
app.post("/api/admin/login",adminLoginLimit,(q,s)=>{if(q.body?.username!==process.env.ADMIN_USER||q.body?.password!==process.env.ADMIN_PASSWORD||!process.env.ADMIN_USER||!process.env.ADMIN_PASSWORD)return s.status(401).json({error:"Incorrect login."});q.session.regenerate(err=>{if(err)return s.status(500).json({error:"Could not start admin session."});q.session.admin=true;q.session.save(err=>err?s.status(500).json({error:"Could not save admin session."}):s.json({ok:true}));});});
app.post("/api/admin/logout",(q,s)=>q.session.destroy(()=>s.json({ok:true})));
app.get("/api/admin/me",(q,s)=>s.json({loggedIn:!!q.session?.admin}));
app.get("/api/admin/products",auth,(q,s)=>s.json(db.products));
app.post("/api/admin/products",auth,async(q,s)=>{try{const b=q.body||{};if(!b.name||!b.category||Number(b.price)<=0)return s.status(400).json({error:"Name, category and price required"});const p={id:"p"+Date.now(),name:b.name,category:b.category,price:Number(b.price),oldPrice:Number(b.oldPrice)||0,stock:Number(b.stock)||0,image:b.image||"",description:b.description||"",active:true};db.products.unshift(p);await save();s.status(201).json(p);}catch(e){console.error(e);s.sendStatus(500);}});
app.put("/api/admin/products/:id",auth,async(q,s)=>{try{const p=db.products.find(x=>x.id===q.params.id);if(!p)return s.sendStatus(404);Object.assign(p,q.body);await save();s.json(p);}catch(e){console.error(e);s.sendStatus(500);}});
app.delete("/api/admin/products/:id",auth,async(q,s)=>{try{db.products=db.products.filter(x=>x.id!==q.params.id);await save();s.json({ok:true});}catch(e){console.error(e);s.sendStatus(500);}});
app.get("/api/admin/orders",auth,(q,s)=>s.json(db.orders));
app.patch("/api/admin/orders/:id",auth,async(q,s)=>{try{const o=db.orders.find(x=>x.id===q.params.id);if(!o)return s.sendStatus(404);const next=q.body?.status;if(!["New","Confirmed","Packed","Shipped","Delivered","Cancelled"].includes(next))return s.sendStatus(400);if(o.status==="Cancelled"&&next!=="Cancelled")return s.status(409).json({error:"Cancelled orders cannot be reopened."});if(next==="Cancelled"&&o.status!=="Cancelled"){if(["Shipped","Delivered"].includes(o.status))return s.status(409).json({error:"Shipped or delivered orders cannot be cancelled here."});o.status="Cancelled";for(const i of o.items||[]){const p=db.products.find(x=>x.id===i.id);if(p)p.stock=Number(p.stock||0)+Number(i.qty||0);}}else o.status=next;await save();s.json(o);}catch(e){console.error(e);s.sendStatus(500);}});
init().then(async()=>{ensureBudgetCatalog();refreshCatalogImages();await save();app.listen(PORT,()=>console.log("SOLOTECH listening on "+PORT));}).catch(e=>{console.error("Startup failed",e);process.exit(1);});
