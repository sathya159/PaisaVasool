Pod::Spec.new do |s|
  s.name = 'KinledgerAssistant'
  s.version = '0.1.0'
  s.summary = 'Private on-device statement assistant'
  s.description = 'Foundation Models, PDFKit and Vision integration for Kinledger.'
  s.author = 'Kinledger'
  s.homepage = 'https://example.invalid/kinledger'
  s.license = { :type => 'UNLICENSED' }
  s.platforms = { :ios => '16.4' }
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.frameworks = 'PDFKit', 'Vision'
  s.weak_frameworks = 'FoundationModels'
  s.swift_version = '5.9'
end

