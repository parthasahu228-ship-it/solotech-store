const express=require("express"),session=require("express-session"),fs=require("fs"),path=require("path");
const app=express(),PORT=process.env.PORT||3000,DB=path.join(__dirname,"store-data.json");
app.use(express.json({limit:"1mb"}));
app.use(session({name:"solotech.sid",secret:process.env.SESSION_SECRET||"replace-this-secret",resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:8*60*60*1000}}));
app.use(express.static(path.join(__dirname,"public")));
const seed=[
{id:"a1",name:"Wireless Headphones",category:"Electronics",price:1299,oldPrice:1799,stock:20,image:"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",description:"Wireless audio for everyday listening.",active:true},
{id:"a2",name:"Smart Watch",category:"Electronics",price:1799,oldPrice:2499,stock:15,image:"https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",description:"A smart everyday accessory.",active:true},
{id:"a3",name:"Bluetooth Speaker",category:"Electronics",price:999,oldPrice:1499,stock:25,image:"https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80",description:"Compact speaker for home and travel.",active:true},
{id:"a4",name:"Charging Cable",category:"Accessories",price:199,oldPrice:299,stock:50,image:"https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80",description:"Everyday charging accessory.",active:true}
];
function load(){if(!fs.existsSync(DB)){fs.writeFileSync(DB,JSON.stringify({products:seed,orders:[]},null,2));}try{return JSON.parse(fs.readFileSync(DB));}catch{return {products:seed,orders:[]};}}
let db=load();const save=()=>fs.writeFileSync(DB,JSON.stringify(db,null,2));
const auth=(q,s,n)=>q.session?.admin?s.status(200)&&n():s.status(401).json({error:"Admin login required"});
app.get("/api/health",(q,s)=>s.json({ok:true}));
app.get("/api/products",(q,s)=>s.json(db.products.filter(p=>p.active)));
app.post("/api/orders",(q,s)=>{const b=q.body||{};if(!b.name||!/^[6-9]\d{9}$/.test(String(b.phone||""))||!b.address||!b.city||!b.state||!/^\d{6}$/.test(String(b.pin||""))||!Array.isArray(b.items)||!b.items.length)return s.status(400).json({error:"Please enter all delivery details correctly."});let items=[],total=0;for(const x of b.items){const p=db.products.find(y=>y.id===x.id&&y.active),qty=Math.max(1,Math.min(10,Number(x.qty)||1));if(!p||p.stock<qty)return s.status(400).json({error:"Product stock unavailable. Refresh your cart."});items.push({id:p.id,name:p.name,price:p.price,qty});total+=p.price*qty;}items.forEach(i=>db.products.find(p=>p.id===i.id).stock-=i.qty);const order={id:"ST"+Date.now(),...{name:b.name,phone:String(b.phone),address:b.address,city:b.city,state:b.state,pin:String(b.pin)},items,total,payment:"Cash on Delivery",status:"New",createdAt:new Date().toISOString()};db.orders.unshift(order);save();s.status(201).json({ok:true,orderId:order.id});});
app.post("/api/admin/login",(q,s)=>{if(q.body?.username===process.env.ADMIN_USER&&q.body?.password===process.env.ADMIN_PASSWORD&&process.env.ADMIN_USER&&process.env.ADMIN_PASSWORD){q.session.admin=true;return s.json({ok:true});}s.status(401).json({error:"Incorrect login."});});
app.post("/api/admin/logout",(q,s)=>q.session.destroy(()=>s.json({ok:true})));
app.get("/api/admin/me",(q,s)=>s.json({loggedIn:!!q.session?.admin}));
app.get("/api/admin/products",auth,(q,s)=>s.json(db.products));
app.post("/api/admin/products",auth,(q,s)=>{const b=q.body||{};if(!b.name||!b.category||Number(b.price)<=0)return s.status(400).json({error:"Name, category and price required"});const p={id:"p"+Date.now(),name:b.name,category:b.category,price:Number(b.price),oldPrice:Number(b.oldPrice)||0,stock:Number(b.stock)||0,image:b.image||"",description:b.description||"",active:true};db.products.unshift(p);save();s.status(201).json(p);});
app.put("/api/admin/products/:id",auth,(q,s)=>{const p=db.products.find(x=>x.id===q.params.id);if(!p)return s.sendStatus(404);Object.assign(p,q.body);save();s.json(p);});
app.delete("/api/admin/products/:id",auth,(q,s)=>{db.products=db.products.filter(x=>x.id!==q.params.id);save();s.json({ok:true});});
app.get("/api/admin/orders",auth,(q,s)=>s.json(db.orders));
app.patch("/api/admin/orders/:id",auth,(q,s)=>{const o=db.orders.find(x=>x.id===q.params.id);if(!o)return s.sendStatus(404);if(!["New","Confirmed","Packed","Shipped","Delivered","Cancelled"].includes(q.body.status))return s.sendStatus(400);o.status=q.body.status;save();s.json(o);});
app.listen(PORT,()=>console.log("SOLOTECH listening on "+PORT));