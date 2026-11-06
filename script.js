import { deleteApp, initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {
    createUserWithEmailAndPassword,
    deleteUser,
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getFirestore,
    onSnapshot,
    serverTimestamp,
    setDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC186QRDYHRZOk1eKR3KkbDdNKb2uKmIzs",
    authDomain: "prompt-express-58ba5.firebaseapp.com",
    projectId: "prompt-express-58ba5",
    storageBucket: "prompt-express-58ba5.firebasestorage.app",
    messagingSenderId: "269456911615",
    appId: "1:269456911615:web:b59200905039b469fc70ca",
    measurementId: "G-EJDH1MD33D"
};

const loginPanel = document.querySelector("#login-panel");
const loginForm = document.querySelector("#login-form");
const loginEmail = document.querySelector("#login-email");
const loginPassword = document.querySelector("#login-password");
const loginButton = document.querySelector("#login-button");
const loginMessage = document.querySelector("#login-message");
const workspace = document.querySelector("#workspace");
const accountLabel = document.querySelector("#account-label");
const logoutButton = document.querySelector("#logout-button");
const customerForm = document.querySelector("#customer-form");
const customerNameInput = document.querySelector("#customer-name");
const saveCustomerButton = document.querySelector("#save-customer");
const searchInput = document.querySelector("#customer-search");
const customerList = document.querySelector("#customer-list");
const customerCount = document.querySelector("#customer-count");
const customerMessage = document.querySelector("#customer-message");
const adminPanel = document.querySelector("#admin-panel");
const employeeForm = document.querySelector("#employee-form");
const employeeEmail = document.querySelector("#employee-email");
const employeePassword = document.querySelector("#employee-password");
const createEmployeeButton = document.querySelector("#create-employee");
const adminMessage = document.querySelector("#admin-message");
const employeeList = document.querySelector("#employee-list");

let auth;
let database;
let customers = [];
let stopWatchingCustomers;
let stopWatchingEmployees;

function showMessage(element, message, kind = "info") {
    element.textContent = message;
    element.dataset.kind = kind;
}

function renderCustomers() {
    const searchTerm = searchInput.value.trim().toLocaleLowerCase("th");
    const filteredCustomers = customers.filter((customer) =>
        customer.name.toLocaleLowerCase("th").includes(searchTerm)
    );

    customerCount.textContent = `${customers.length} รายชื่อ`;
    customerList.replaceChildren();

    if (filteredCustomers.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "list-placeholder";
        emptyItem.textContent = customers.length === 0
            ? "ยังไม่มีรายชื่อลูกค้า เพิ่มรายชื่อแรกของทีมได้เลย"
            : "ไม่พบชื่อลูกค้าที่ค้นหา";
        customerList.append(emptyItem);
        return;
    }

    for (const customer of filteredCustomers) {
        const item = document.createElement("li");
        item.className = "customer-item";

        const avatar = document.createElement("span");
        avatar.className = "customer-avatar";
        avatar.setAttribute("aria-hidden", "true");
        avatar.textContent = customer.name.trim().charAt(0).toLocaleUpperCase("th");

        const name = document.createElement("span");
        name.className = "customer-name";
        name.textContent = customer.name;

        item.append(avatar, name);
        customerList.append(item);
    }
}

function renderEmployees(snapshot, currentUserId) {
    employeeList.replaceChildren();
    const employees = snapshot.docs
        .map((employeeDocument) => ({
            id: employeeDocument.id,
            ...employeeDocument.data()
        }))
        .sort((first, second) => String(first.email).localeCompare(String(second.email)));
    const adminCount = employees.filter((employee) => employee.role === "admin").length;

    if (employees.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "list-placeholder";
        emptyItem.textContent = "ยังไม่มีบัญชีพนักงาน";
        employeeList.append(emptyItem);
        return;
    }

    for (const employee of employees) {
        const item = document.createElement("li");
        item.className = "employee-row";

        const details = document.createElement("div");
        const email = document.createElement("span");
        email.className = "employee-email";
        email.textContent = employee.email || "ไม่มีอีเมล";
        const role = document.createElement("span");
        role.className = "employee-role";
        role.textContent = employee.role === "admin" ? "ผู้ดูแลระบบ" : "พนักงาน";
        details.append(email, role);

        const roleButton = document.createElement("button");
        roleButton.className = "role-button";
        roleButton.type = "button";
        roleButton.dataset.userId = employee.id;
        roleButton.dataset.role = employee.role === "admin" ? "employee" : "admin";
        roleButton.textContent = employee.role === "admin" ? "ลดสิทธิ์" : "ตั้งเป็นแอดมิน";
        roleButton.disabled = employee.id === currentUserId
            || (employee.role === "admin" && adminCount === 1);
        roleButton.setAttribute(
            "aria-label",
            employee.id === currentUserId
                ? "ไม่สามารถเปลี่ยนสิทธิ์บัญชีที่กำลังใช้งาน"
                : employee.role === "admin" && adminCount === 1
                    ? "ต้องมีแอดมินอย่างน้อยหนึ่งบัญชี"
                : `${roleButton.textContent}: ${employee.email || "บัญชีนี้"}`
        );

        item.append(details, roleButton);
        employeeList.append(item);
    }
}

function stopWorkspaceListeners() {
    if (stopWatchingCustomers) {
        stopWatchingCustomers();
        stopWatchingCustomers = undefined;
    }
    if (stopWatchingEmployees) {
        stopWatchingEmployees();
        stopWatchingEmployees = undefined;
    }
}

function startWorkspaceListeners(user, role) {
    stopWorkspaceListeners();
    searchInput.value = "";
    customerCount.textContent = "กำลังโหลด...";
    customerList.replaceChildren();
    const loadingItem = document.createElement("li");
    loadingItem.className = "list-placeholder";
    loadingItem.textContent = "กำลังโหลดรายชื่อลูกค้า...";
    customerList.append(loadingItem);

    stopWatchingCustomers = onSnapshot(
        collection(database, "customers"),
        (snapshot) => {
            customers = snapshot.docs
                .map((customerDocument) => ({
                    id: customerDocument.id,
                    name: customerDocument.data().name
                }))
                .filter((customer) => typeof customer.name === "string")
                .sort((first, second) => first.name.localeCompare(second.name, "th"));
            renderCustomers();
            showMessage(customerMessage, "");
        },
        (error) => {
            console.error("Unable to load customers from Firestore.", error);
            customerCount.textContent = "โหลดข้อมูลไม่สำเร็จ";
            customerList.replaceChildren();
            const errorItem = document.createElement("li");
            errorItem.className = "list-placeholder";
            errorItem.textContent = "โหลดข้อมูลไม่ได้ กรุณาตรวจสอบการเชื่อมต่อและ Firestore Rules";
            customerList.append(errorItem);
            showMessage(customerMessage, "โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ฐานข้อมูล", "error");
        }
    );

    if (role === "admin") {
        stopWatchingEmployees = onSnapshot(
            collection(database, "users"),
            (snapshot) => renderEmployees(snapshot, user.uid),
            (error) => {
                console.error("Unable to load employee accounts.", error);
                employeeList.replaceChildren();
                const errorItem = document.createElement("li");
                errorItem.className = "list-placeholder";
                errorItem.textContent = "โหลดบัญชีไม่ได้ กรุณาตรวจสอบ Firestore Rules";
                employeeList.append(errorItem);
                showMessage(adminMessage, "โหลดบัญชีพนักงานไม่สำเร็จ", "error");
            }
        );
    }
}

if (Object.values(firebaseConfig).some((value) => !value.trim() || value.startsWith("YOUR_"))) {
    loginButton.disabled = true;
    showMessage(loginMessage, "กรุณาตั้งค่า Firebase config ใน script.js ก่อนใช้งาน", "error");
} else {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    database = getFirestore(app);

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        loginButton.disabled = true;
        showMessage(loginMessage, "กำลังเข้าสู่ระบบ...");

        try {
            await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
            loginForm.reset();
            showMessage(loginMessage, "");
        } catch (error) {
            console.error("Unable to sign in.", error);
            showMessage(loginMessage, "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน", "error");
        } finally {
            loginButton.disabled = false;
        }
    });

    logoutButton.addEventListener("click", async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Unable to sign out.", error);
            showMessage(customerMessage, "ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง", "error");
        }
    });

    onAuthStateChanged(auth, async (user) => {
        stopWorkspaceListeners();
        customers = [];
        workspace.hidden = true;
        loginPanel.hidden = !user;

        if (!user) {
            loginPanel.hidden = false;
            adminPanel.hidden = true;
            return;
        }

        try {
            const userProfile = await getDoc(doc(database, "users", user.uid));
            const role = userProfile.data()?.role;

            if (!userProfile.exists() || !["admin", "employee"].includes(role)) {
                showMessage(loginMessage, "บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าใช้งาน กรุณาติดต่อแอดมิน", "error");
                await signOut(auth);
                return;
            }

            accountLabel.textContent = `${user.email || ""} · ${role === "admin" ? "แอดมิน" : "พนักงาน"}`;
            adminPanel.hidden = role !== "admin";
            workspace.hidden = false;
            loginPanel.hidden = true;
            startWorkspaceListeners(user, role);
        } catch (error) {
            console.error("Unable to verify user access.", error);
            showMessage(loginMessage, "ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ", "error");
            await signOut(auth);
        }
    });

    customerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const name = customerNameInput.value.trim();

        if (!name) {
            customerNameInput.setCustomValidity("กรุณากรอกชื่อลูกค้า");
            customerNameInput.reportValidity();
            return;
        }
        customerNameInput.setCustomValidity("");

        saveCustomerButton.disabled = true;
        showMessage(customerMessage, "กำลังบันทึก...");

        try {
            await addDoc(collection(database, "customers"), {
                name,
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser.uid
            });
            customerForm.reset();
            customerNameInput.focus();
            showMessage(customerMessage, "เพิ่มรายชื่อลูกค้าเรียบร้อยแล้ว");
        } catch (error) {
            console.error("Unable to save customer.", error);
            showMessage(customerMessage, "บันทึกไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ฐานข้อมูลแล้วลองอีกครั้ง", "error");
        } finally {
            saveCustomerButton.disabled = false;
        }
    });

    customerNameInput.addEventListener("input", () => {
        customerNameInput.setCustomValidity("");
    });
    searchInput.addEventListener("input", renderCustomers);

    employeeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = employeeEmail.value.trim();
        const password = employeePassword.value;
        createEmployeeButton.disabled = true;
        showMessage(adminMessage, "กำลังสร้างบัญชี...");

        let provisioningApp;
        let createdUser;
        let profileCreated = false;
        try {
            provisioningApp = initializeApp(firebaseConfig, `employee-setup-${Date.now()}`);
            const provisioningAuth = getAuth(provisioningApp);
            const credentials = await createUserWithEmailAndPassword(provisioningAuth, email, password);
            createdUser = credentials.user;
            await setDoc(doc(database, "users", credentials.user.uid), {
                email,
                role: "employee",
                createdAt: serverTimestamp()
            });
            profileCreated = true;
            employeeForm.reset();
            showMessage(adminMessage, "สร้างบัญชีพนักงานเรียบร้อยแล้ว");
        } catch (error) {
            console.error("Unable to create employee account.", error);
            let message;
            if (createdUser && !profileCreated) {
                try {
                    await deleteUser(createdUser);
                    message = "สร้างสิทธิ์บัญชีไม่สำเร็จ ระบบยกเลิกบัญชีที่สร้างไว้แล้ว กรุณาตรวจสอบ Firestore Rules";
                } catch (cleanupError) {
                    console.error("Unable to remove incomplete employee account.", cleanupError);
                    message = "สร้างบัญชีไม่สมบูรณ์ กรุณาลบบัญชีนี้จาก Firebase Authentication ก่อนลองใหม่";
                }
            } else {
                message = error.code === "auth/email-already-in-use"
                    ? "อีเมลนี้มีบัญชีอยู่แล้ว"
                    : error.code === "auth/weak-password"
                        ? "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"
                        : "สร้างบัญชีไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า Firebase และสิทธิ์";
            }
            showMessage(adminMessage, message, "error");
        } finally {
            if (provisioningApp) {
                try {
                    await deleteApp(provisioningApp);
                } catch (error) {
                    console.error("Unable to clean up employee setup app.", error);
                }
            }
            createEmployeeButton.disabled = false;
        }
    });

    employeeList.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-user-id]");
        if (!button || button.disabled) {
            return;
        }

        button.disabled = true;
        try {
            await updateDoc(doc(database, "users", button.dataset.userId), {
                role: button.dataset.role
            });
            showMessage(adminMessage, "ปรับสิทธิ์บัญชีเรียบร้อยแล้ว");
        } catch (error) {
            console.error("Unable to update employee role.", error);
            showMessage(adminMessage, "ปรับสิทธิ์ไม่สำเร็จ กรุณาลองอีกครั้ง", "error");
        } finally {
            button.disabled = false;
        }
    });
}
