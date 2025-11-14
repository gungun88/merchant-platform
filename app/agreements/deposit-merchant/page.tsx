"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, FileText } from "lucide-react"

export default function DepositMerchantAgreementPage() {
  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* 返回按钮 */}
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回首页
          </Button>
        </Link>

        {/* 标题 */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">押金商家服务协议</h1>
          </div>
          <p className="text-muted-foreground">生效日期：2025年1月1日</p>
        </div>

        {/* 协议内容 */}
        <Card>
          <CardContent className="p-6 md:p-8 prose prose-slate max-w-none">
            <div className="space-y-6 text-sm leading-relaxed">
              <p className="text-base font-medium">
                欢迎您申请成为本平台的押金商家！在您申请之前，请仔细阅读本协议的全部内容。一旦您勾选"同意"并提交申请，即表示您已充分理解并同意遵守本协议的所有条款。
              </p>

              <hr className="my-6" />

              <section>
                <h2 className="text-xl font-bold mb-4">一、定义与说明</h2>
                <p><strong>1.1 押金商家：</strong>指在本平台缴纳一定金额押金（最低500 USDT），经平台审核通过后获得特殊认证标识的商家用户。</p>
                <p><strong>1.2 平台：</strong>指本跨境服务商展示平台及其运营主体。</p>
                <p><strong>1.3 押金：</strong>指商家为获得押金商家资格而向平台缴纳的保证金，以USDT计价，金额由商家自主选择（最低500 USDT，建议500/1000/2000 USDT）。</p>
                <p><strong>1.4 服务期限：</strong>押金商家认证为长期有效，除非发生违规行为或商家主动申请退还。</p>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-4">二、申请资格与审核</h2>
                <h3 className="text-lg font-semibold mb-2">2.1 申请条件</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>已在平台注册并完成商家认证</li>
                  <li>商家信息真实、完整、准确</li>
                  <li>无违规记录或违规记录已处理完毕</li>
                  <li>同意遵守本协议及平台相关规则</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">2.2 审核流程</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>商家提交押金申请，选择押金金额</li>
                  <li>按照平台指定方式支付押金（USDT）</li>
                  <li>上传支付凭证和交易哈希</li>
                  <li>平台在1-3个工作日内完成审核</li>
                  <li>审核通过后，商家账户将显示押金商家标识</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">2.3 审核标准</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>支付凭证清晰可辨，金额准确</li>
                  <li>交易哈希真实有效，可在区块链上查询</li>
                  <li>商家信息与申请信息一致</li>
                  <li>无虚假信息或欺诈行为</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-4">三、押金商家权益</h2>
                <h3 className="text-lg font-semibold mb-2">3.1 专属标识</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>获得"押金商家"认证徽章</li>
                  <li>在商家列表中优先展示</li>
                  <li>提升买家信任度和转化率</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">3.2 积分奖励（具体金额以系统设置为准）</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>审核通过一次性奖励：</strong>默认1000积分</li>
                  <li><strong>每日登录奖励：</strong>默认50积分/天（需每日登录领取）</li>
                  <li><strong>追加押金奖励：</strong>追加押金审核通过后可获得额外积分</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">3.3 优先服务</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>优先处理商家申诉和咨询</li>
                  <li>优先参与平台活动和推广</li>
                  <li>获得更多曝光机会</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">3.4 押金追加</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>商家可随时申请追加押金</li>
                  <li>追加押金后可获得更高的信任度展示</li>
                  <li>追加押金需提交新的支付凭证并经平台审核</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-4">四、商家义务与规范</h2>
                <h3 className="text-lg font-semibold mb-2">4.1 诚信经营</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>提供真实、准确的商家信息和服务描述</li>
                  <li>不得发布虚假广告或误导性信息</li>
                  <li>不得恶意竞争或诋毁其他商家</li>
                  <li>诚实守信，按照承诺提供服务</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">4.2 服务质量</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>及时响应买家咨询（响应时间应与标注一致）</li>
                  <li>保证服务质量符合描述标准</li>
                  <li>妥善处理买家投诉和纠纷</li>
                  <li>提供必要的售后服务</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">4.3 合规经营</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>遵守国家法律法规和行业规范</li>
                  <li>不得从事非法业务或违规交易</li>
                  <li>不得利用平台进行欺诈、洗钱等违法活动</li>
                  <li>保护买家隐私和数据安全</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">4.4 信息维护</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>及时更新商家信息和联系方式</li>
                  <li>确保上传的资料真实有效</li>
                  <li>配合平台的审核和核查工作</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-4">五、押金管理</h2>
                <h3 className="text-lg font-semibold mb-2">5.1 押金缴纳</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>押金以USDT支付，最低金额为500 USDT</li>
                  <li>支付方式：按照平台指定的钱包地址转账</li>
                  <li>需提供支付凭证截图和交易哈希</li>
                  <li>押金到账后方可开始审核</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">5.2 押金用途</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>押金作为商家信用保证金</li>
                  <li>用于赔付买家因商家违规造成的损失</li>
                  <li>用于支付商家违约产生的罚金</li>
                  <li>押金不产生利息</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">5.3 押金追加</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>商家可随时申请追加押金</li>
                  <li>追加押金按照初次申请流程进行</li>
                  <li>追加后的总押金金额将在商家资料中展示</li>
                  <li>追加押金可获得额外的积分奖励</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">5.4 押金退还</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>商家可随时申请退还押金</li>
                  <li>申请退还后，押金商家资格将被取消</li>
                  <li>平台在审核通过后1-3个工作日内退还押金</li>
                  <li>如有未处理完的投诉或纠纷，将暂缓退还</li>
                  <li>如因商家违规产生罚金，将从押金中扣除后退还余额</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-4">六、违规处理</h2>
                <h3 className="text-lg font-semibold mb-2">6.1 违规行为</h3>
                <p>包括但不限于：</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>发布虚假信息或欺诈行为</li>
                  <li>严重服务质量问题导致大量投诉</li>
                  <li>恶意竞争或诋毁其他商家</li>
                  <li>违反国家法律法规</li>
                  <li>利用平台进行非法活动</li>
                  <li>拒不配合平台审核或调查</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">6.2 处罚措施</h3>
                <p>根据违规严重程度，平台可采取以下措施：</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>警告：</strong>首次轻微违规，予以警告</li>
                  <li><strong>限制服务：</strong>暂时限制商家部分功能</li>
                  <li><strong>罚款：</strong>从押金中扣除相应罚金（100-2000 USDT）</li>
                  <li><strong>暂停服务：</strong>暂停商家展示和服务</li>
                  <li><strong>取消资格：</strong>取消押金商家资格，扣除押金</li>
                  <li><strong>永久封禁：</strong>严重违规者永久封禁账户</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">6.3 赔付责任</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>因商家违规造成买家损失的，平台有权从押金中扣除赔付金额</li>
                  <li>押金不足以赔付的，商家需补足差额</li>
                  <li>平台有权追究商家的法律责任</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-4">七、争议解决</h2>
                <h3 className="text-lg font-semibold mb-2">7.1 投诉处理</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>买家投诉将由平台客服团队调查处理</li>
                  <li>商家需在24小时内回应并配合调查</li>
                  <li>平台将根据事实和证据做出公正判断</li>
                  <li>商家对处理结果有异议可提起申诉</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">7.2 申诉机制</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>商家可在处罚决定后7日内提起申诉</li>
                  <li>申诉需提供充分的证据和理由</li>
                  <li>平台将在3个工作日内复审并给予答复</li>
                  <li>申诉结果为最终决定</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">7.3 法律适用</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>本协议适用中华人民共和国法律</li>
                  <li>因本协议引起的争议，双方应友好协商解决</li>
                  <li>协商不成的，提交平台所在地人民法院诉讼解决</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-4">八、协议变更与终止</h2>
                <h3 className="text-lg font-semibold mb-2">8.1 协议变更</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>平台有权根据业务发展需要修改本协议</li>
                  <li>协议修改后将在平台公告并通知商家</li>
                  <li>商家继续使用服务视为同意修改后的协议</li>
                  <li>不同意修改的可申请退还押金并终止服务</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">8.2 服务终止</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>商家可随时申请退还押金并终止服务</li>
                  <li>平台因商家严重违规可强制终止服务</li>
                  <li>服务终止后，商家的押金商家资格将被取消</li>
                  <li>已获得的积分奖励不予退还</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-4">九、免责声明</h2>
                <h3 className="text-lg font-semibold mb-2">9.1 平台责任</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>平台仅提供商家展示和推广服务</li>
                  <li>平台不对商家与买家之间的交易负责</li>
                  <li>平台不担保商家的服务质量</li>
                  <li>平台尽力维护平台秩序，但不承担无限责任</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">9.2 商家责任</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>商家对自己的服务质量和信用负全部责任</li>
                  <li>商家应自行处理与买家之间的纠纷</li>
                  <li>商家应承担因违规造成的一切后果</li>
                  <li>商家应自行承担经营风险</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-4">十、其他条款</h2>
                <h3 className="text-lg font-semibold mb-2">10.1 协议完整性</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>本协议构成双方之间的完整协议</li>
                  <li>取代此前的口头或书面协议</li>
                  <li>本协议的任何修改须以书面形式做出</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">10.2 可分割性</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>如本协议任何条款被认定无效或不可执行</li>
                  <li>不影响其他条款的效力</li>
                  <li>无效条款将被修改为最接近原意且合法的内容</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">10.3 通知方式</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>平台通过站内信、邮件或手机短信方式通知商家</li>
                  <li>商家应确保联系方式准确有效</li>
                  <li>通知发出后视为已送达</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 mt-4">10.4 语言文字</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>本协议以简体中文编写</li>
                  <li>如有其他语言版本，以简体中文版本为准</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-4">十一、联系方式</h2>
                <p>如您对本协议有任何疑问或建议，请通过以下方式联系我们：</p>
                <ul className="list-none pl-0 space-y-2 mt-3">
                  <li><strong>官方网站：</strong><a href="https://doingfb.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://doingfb.com</a></li>
                  <li><strong>客服邮箱：</strong><a href="mailto:info@doingfb.com" className="text-primary hover:underline">info@doingfb.com</a></li>
                  <li><strong>在线客服：</strong>平台右下角在线客服入口</li>
                </ul>
              </section>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
                <h3 className="font-bold text-yellow-900 mb-2">重要提示：</h3>
                <ul className="list-disc pl-6 space-y-1 text-yellow-900 text-sm">
                  <li>请在申请前仔细阅读本协议的全部内容</li>
                  <li>如有不明白的地方，请先联系客服咨询</li>
                  <li>一旦提交申请，即表示您已完全理解并同意本协议</li>
                  <li>押金商家资格珍贵，请务必诚信经营</li>
                </ul>
                <p className="mt-3 font-semibold text-yellow-900">祝您在平台获得成功！</p>
              </div>

              <div className="text-center mt-6 text-sm text-muted-foreground">
                <p>本协议最终解释权归平台所有</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 返回按钮 */}
        <div className="mt-6 text-center">
          <Link href="/">
            <Button variant="outline">
              返回首页
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
