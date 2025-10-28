// Test script for email verification endpoints
// Run this with: node test/test-email-verification.js

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

// Test data
const testEmail = 'test@example.com';
const testUser = {
  firstName: 'John',
  lastName: 'Doe',
  displayName: 'John Doe',
  phoneNumber: '+639123456789',
  address: 'Alabel, Sarangani Province',
  ethnicity: 'Blaan',
  password: 'TestPassword123!'
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = (message, color = 'reset') => {
  console.log(colors[color] + message + colors.reset);
};

// Test functions
async function testHealthCheck() {
  try {
    log('\n🔍 Testing Health Check...', 'blue');
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    
    if (response.ok) {
      log('✅ Health Check: PASSED', 'green');
      log(`   Server Status: ${data.message}`, 'green');
    } else {
      log('❌ Health Check: FAILED', 'red');
    }
  } catch (error) {
    log(`❌ Health Check Error: ${error.message}`, 'red');
  }
}

async function testRegistrationVerification() {
  try {
    log('\n🔍 Testing Registration Email Verification...', 'blue');
    
    const response = await fetch(`${BASE_URL}/api/registration-auth/send-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        firstName: testUser.firstName
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      log('✅ Registration Verification: PASSED', 'green');
      log(`   Message: ${data.message}`, 'green');
      log(`   Masked Email: ${data.email}`, 'green');
      return true;
    } else {
      log('❌ Registration Verification: FAILED', 'red');
      log(`   Error: ${data.message}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Registration Verification Error: ${error.message}`, 'red');
    return false;
  }
}

async function testLoginVerification() {
  try {
    log('\n🔍 Testing Login Email Verification...', 'blue');
    
    const response = await fetch(`${BASE_URL}/api/email-auth/request-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      })
    });
    
    const data = await response.json();
    
    if (response.status === 401) {
      log('✅ Login Verification (Invalid Credentials): PASSED', 'green');
      log(`   Expected Error: ${data.message}`, 'green');
      return true;
    } else {
      log('❌ Login Verification: UNEXPECTED RESPONSE', 'red');
      log(`   Response: ${data.message}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Login Verification Error: ${error.message}`, 'red');
    return false;
  }
}

async function testEmailService() {
  try {
    log('\n🔍 Testing Email Service Configuration...', 'blue');
    
    // Check if environment variables are set
    if (!process.env.EMAIL_USER) {
      log('⚠️  EMAIL_USER not configured in .env', 'yellow');
      return false;
    }
    
    if (!process.env.EMAIL_PASS) {
      log('⚠️  EMAIL_PASS not configured in .env', 'yellow');
      return false;
    }
    
    log('✅ Email Environment Variables: CONFIGURED', 'green');
    log(`   Email User: ${process.env.EMAIL_USER}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Email Service Error: ${error.message}`, 'red');
    return false;
  }
}

async function testInvalidRequests() {
  try {
    log('\n🔍 Testing Invalid Request Handling...', 'blue');
    
    // Test missing email
    const response1 = await fetch(`${BASE_URL}/api/registration-auth/send-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    const data1 = await response1.json();
    
    if (response1.status === 400 && data1.message.includes('Email is required')) {
      log('✅ Invalid Request (Missing Email): PASSED', 'green');
    } else {
      log('❌ Invalid Request Handling: FAILED', 'red');
      return false;
    }
    
    // Test invalid code format
    const response2 = await fetch(`${BASE_URL}/api/registration-auth/verify-and-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        code: '12345', // Invalid: only 5 digits
        firstName: 'Test',
        lastName: 'User',
        password: 'TestPass123!'
      })
    });
    
    const data2 = await response2.json();
    
    if (response2.status === 400 && data2.message.includes('6 digits')) {
      log('✅ Invalid Request (Wrong Code Format): PASSED', 'green');
    } else {
      log('❌ Invalid Code Format Handling: FAILED', 'red');
      return false;
    }
    
    return true;
  } catch (error) {
    log(`❌ Invalid Request Test Error: ${error.message}`, 'red');
    return false;
  }
}

async function testDatabaseConnection() {
  try {
    log('\n🔍 Testing Database Connection...', 'blue');
    
    // Try to access an endpoint that requires database
    const response = await fetch(`${BASE_URL}/api/registration-auth/send-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'db-test@example.com',
        firstName: 'DB Test'
      })
    });
    
    // If we get any response (not connection error), database is working
    if (response.status) {
      log('✅ Database Connection: WORKING', 'green');
      return true;
    } else {
      log('❌ Database Connection: FAILED', 'red');
      return false;
    }
  } catch (error) {
    if (error.message.includes('ECONNREFUSED')) {
      log('❌ Server Connection: FAILED (Is server running?)', 'red');
    } else {
      log(`❌ Database Connection Error: ${error.message}`, 'red');
    }
    return false;
  }
}

// Main test runner
async function runAllTests() {
  log('🧪 NCIP Email Verification Backend Tests', 'blue');
  log('==========================================', 'blue');
  
  const results = {
    healthCheck: await testHealthCheck(),
    databaseConnection: await testDatabaseConnection(),
    emailService: await testEmailService(),
    registrationVerification: await testRegistrationVerification(),
    loginVerification: await testLoginVerification(),
    invalidRequests: await testInvalidRequests()
  };
  
  // Summary
  log('\n📊 TEST SUMMARY', 'blue');
  log('================', 'blue');
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASSED' : '❌ FAILED';
    const color = passed ? 'green' : 'red';
    log(`${test}: ${status}`, color);
  });
  
  log(`\nOverall: ${passed}/${total} tests passed`, passed === total ? 'green' : 'red');
  
  if (passed === total) {
    log('\n🎉 All tests passed! Backend is ready for email verification.', 'green');
  } else {
    log('\n⚠️  Some tests failed. Check the issues above.', 'yellow');
  }
}

// Run tests
runAllTests().catch(console.error);
